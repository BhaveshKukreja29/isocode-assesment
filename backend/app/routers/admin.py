from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.db import contains
from app.deps import AdminUser, Session, not_found
from app.models import (
    AccessoryPack,
    CarModel,
    City,
    Colour,
    RoadTaxSlab,
    Showroom,
    UsedCar,
    User,
    Variant,
    VariantPrice,
)
from app.models.enums import Role, StockStatus
from app.schemas.admin import (
    AdminCity,
    AdminModel,
    AdminModelRow,
    AdminUsedCar,
    CityCharges,
    GridVariant,
    ModelIn,
    PriceCell,
    PriceGrid,
    StaffAccount,
    UsedCarIn,
    UserIn,
    UserPatch,
    VariantIn,
)
from app.schemas.catalog import CityOut
from app.schemas.common import Page
from app.security import hash_password
from app.services.pricing import validate_slabs

router = APIRouter(prefix="/admin", tags=["admin"])


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def invalid(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


async def commit_or_conflict(session: Session, message: str) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise conflict(message) from exc


# ---------------------------------------------------------------- models & variants


async def load_model(session: Session, model_id: int) -> CarModel:
    model = await session.scalar(
        select(CarModel)
        .where(CarModel.id == model_id)
        .options(
            selectinload(CarModel.variants),
            selectinload(CarModel.colours),
            selectinload(CarModel.accessory_packs),
        )
        .execution_options(populate_existing=True)
    )
    if model is None:
        raise not_found("Model not found")
    return model


@router.get("/models", response_model=list[AdminModelRow])
async def list_models(_: AdminUser, session: Session):
    variant_count = select(func.count()).where(Variant.model_id == CarModel.id).scalar_subquery()
    priced = (
        select(func.count())
        .select_from(VariantPrice)
        .join(Variant)
        .where(Variant.model_id == CarModel.id)
        .scalar_subquery()
    )
    rows = await session.execute(
        select(CarModel, variant_count, priced).order_by(CarModel.sort_order, CarModel.name)
    )
    return [
        AdminModelRow(
            id=m.id,
            slug=m.slug,
            name=m.name,
            body_type=m.body_type,
            is_published=m.is_published,
            variant_count=variants,
            priced_cells=cells,
        )
        for m, variants, cells in rows
    ]


@router.get("/models/{model_id}", response_model=AdminModel)
async def get_model(model_id: int, _: AdminUser, session: Session):
    return await load_model(session, model_id)


def apply_model(model: CarModel, body: ModelIn) -> None:
    data = body.model_dump(mode="json", exclude={"colours", "accessory_packs"})
    for field, value in data.items():
        setattr(model, field, value)
    model.colours = [Colour(**c.model_dump()) for c in body.colours]
    model.accessory_packs = [AccessoryPack(**p.model_dump()) for p in body.accessory_packs]


@router.post("/models", status_code=201, response_model=AdminModel)
async def create_model(body: ModelIn, _: AdminUser, session: Session):
    model = CarModel(variants=[], colours=[], accessory_packs=[])
    apply_model(model, body)
    session.add(model)
    await commit_or_conflict(session, "A model with this URL slug already exists")
    return await load_model(session, model.id)


@router.put("/models/{model_id}", response_model=AdminModel)
async def update_model(model_id: int, body: ModelIn, _: AdminUser, session: Session):
    model = await load_model(session, model_id)
    apply_model(model, body)
    await commit_or_conflict(session, "A model with this URL slug already exists")
    return await load_model(session, model_id)


@router.post("/models/{model_id}/variants", status_code=201, response_model=AdminModel)
async def add_variant(model_id: int, body: VariantIn, _: AdminUser, session: Session):
    await load_model(session, model_id)
    session.add(Variant(model_id=model_id, **body.model_dump()))
    await session.commit()
    return await load_model(session, model_id)


@router.put("/variants/{variant_id}", response_model=AdminModel)
async def update_variant(variant_id: int, body: VariantIn, _: AdminUser, session: Session):
    variant = await session.get(Variant, variant_id)
    if variant is None:
        raise not_found("Variant not found")
    for field, value in body.model_dump().items():
        setattr(variant, field, value)
    await session.commit()
    return await load_model(session, variant.model_id)


# ---------------------------------------------------------------- price table


@router.get("/prices", response_model=PriceGrid)
async def price_grid(model_id: int, _: AdminUser, session: Session):
    model = await load_model(session, model_id)
    cities = (await session.scalars(select(City).order_by(City.name))).all()
    cells = await session.scalars(
        select(VariantPrice).where(VariantPrice.variant_id.in_([v.id for v in model.variants]))
    )
    by_variant: dict[int, dict[int, PriceCell]] = {}
    for cell in cells:
        by_variant.setdefault(cell.variant_id, {})[cell.city_id] = PriceCell(
            variant_id=cell.variant_id,
            city_id=cell.city_id,
            ex_showroom=cell.ex_showroom,
            valid_until=cell.valid_until,
        )
    return PriceGrid(
        cities=[CityOut.model_validate(c) for c in cities],
        variants=[
            GridVariant(
                id=v.id,
                name=v.name,
                fuel=v.fuel,
                transmission=v.transmission,
                is_active=v.is_active,
                prices=by_variant.get(v.id, {}),
            )
            for v in model.variants
        ],
    )


class PriceUpdate(BaseModel):
    cells: list[PriceCell] = Field(min_length=1, max_length=500)


@router.put("/prices", status_code=204)
async def save_prices(body: PriceUpdate, _: AdminUser, session: Session):
    stmt = insert(VariantPrice).values([c.model_dump() for c in body.cells])
    stmt = stmt.on_conflict_do_update(
        index_elements=[VariantPrice.variant_id, VariantPrice.city_id],
        set_={
            "ex_showroom": stmt.excluded.ex_showroom,
            "valid_until": stmt.excluded.valid_until,
            "updated_at": func.now(),
        },
    )
    try:
        await session.execute(stmt)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise invalid("Unknown variant or city in the price table") from exc


# ---------------------------------------------------------------- cities, tax, fees


@router.get("/cities", response_model=list[AdminCity])
async def list_cities(_: AdminUser, session: Session):
    return (
        await session.scalars(
            select(City).options(selectinload(City.tax_slabs)).order_by(City.name)
        )
    ).all()


@router.put("/cities/{city_id}", response_model=AdminCity)
async def update_city(city_id: int, body: CityCharges, _: AdminUser, session: Session):
    city = await session.scalar(
        select(City).where(City.id == city_id).options(selectinload(City.tax_slabs))
    )
    if city is None:
        raise not_found("City not found")
    if problems := validate_slabs(body.tax_slabs):
        raise invalid("; ".join(problems))
    city.registration_fee = body.registration_fee
    city.fastag_fee = body.fastag_fee
    city.insurance_rate = body.insurance_rate
    city.tax_slabs = [RoadTaxSlab(**s.model_dump()) for s in body.tax_slabs]
    await session.commit()
    await session.refresh(city, ["tax_slabs"])
    return city


# ---------------------------------------------------------------- used stock


class UsedCarQuery(BaseModel):
    q: str | None = Field(None, max_length=60)
    status: StockStatus | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(25, ge=1, le=100)


@router.get("/used-cars", response_model=Page[AdminUsedCar])
async def list_used_stock(_: AdminUser, session: Session, f: Annotated[UsedCarQuery, Query()]):
    stmt = select(UsedCar)
    if f.status:
        stmt = stmt.where(UsedCar.status == f.status)
    if f.q:
        term = contains(f.q)
        stmt = stmt.where(
            or_(
                UsedCar.stock_id.ilike(term),
                UsedCar.model.ilike(term),
                UsedCar.registration_no.ilike(term),
            )
        )
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(
        stmt.order_by(UsedCar.created_at.desc(), UsedCar.id.desc())
        .offset((f.page - 1) * f.page_size)
        .limit(f.page_size)
    )
    return Page(items=rows.all(), total=total or 0, page=f.page, page_size=f.page_size)


def used_car_slug(body: UsedCarIn) -> str:
    words = f"{body.year} {body.make} {body.model} {body.variant} {body.stock_id}"
    return "-".join("".join(ch for ch in w.lower() if ch.isalnum()) for w in words.split())


async def apply_used_car(session: Session, car: UsedCar, body: UsedCarIn) -> None:
    if await session.get(Showroom, body.showroom_id) is None:
        raise invalid("Unknown showroom")
    data = body.model_dump(mode="json", exclude={"inspection"})
    for field, value in data.items():
        setattr(car, field, value)
    car.inspection = body.inspection.model_dump(mode="json") if body.inspection else {}
    car.slug = used_car_slug(body)


@router.post("/used-cars", status_code=201, response_model=AdminUsedCar)
async def create_used_car(body: UsedCarIn, _: AdminUser, session: Session):
    car = UsedCar()
    await apply_used_car(session, car, body)
    session.add(car)
    await commit_or_conflict(session, "Stock ID already exists")
    return car


@router.put("/used-cars/{car_id}", response_model=AdminUsedCar)
async def update_used_car(car_id: int, body: UsedCarIn, _: AdminUser, session: Session):
    car = await session.get(UsedCar, car_id)
    if car is None:
        raise not_found("Car not found")
    await apply_used_car(session, car, body)
    await commit_or_conflict(session, "Stock ID already exists")
    return car


# ---------------------------------------------------------------- users & roles


async def load_user(session: Session, user_id: int) -> User:
    user = await session.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.models))
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise not_found("User not found")
    return user


async def models_by_id(session: Session, ids: list[int]) -> list[CarModel]:
    models = (await session.scalars(select(CarModel).where(CarModel.id.in_(ids)))).all()
    if len(models) != len(set(ids)):
        raise invalid("Unknown model in specialisations")
    return list(models)


@router.get("/users", response_model=list[StaffAccount])
async def list_users(_: AdminUser, session: Session, role: Role | None = None):
    stmt = select(User).options(selectinload(User.models)).order_by(User.role, User.name)
    if role:
        stmt = stmt.where(User.role == role)
    return (await session.scalars(stmt)).all()


@router.post("/users", status_code=201, response_model=StaffAccount)
async def create_user(body: UserIn, _: AdminUser, session: Session):
    user = User(
        name=body.name,
        email=body.email.lower(),
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=body.role,
        showroom_id=body.showroom_id,
        models=await models_by_id(session, body.model_ids),
    )
    session.add(user)
    await commit_or_conflict(session, "A user with this email already exists")
    return await load_user(session, user.id)


@router.patch("/users/{user_id}", response_model=StaffAccount)
async def update_user(user_id: int, body: UserPatch, me: AdminUser, session: Session):
    user = await load_user(session, user_id)
    if user.id == me.id and (body.role not in (None, me.role) or body.is_active is False):
        raise invalid("You can't remove your own admin access")
    changes = body.model_dump(exclude_unset=True, exclude={"model_ids"})
    for field, value in changes.items():
        setattr(user, field, value)
    if body.model_ids is not None:
        user.models = await models_by_id(session, body.model_ids)
    await commit_or_conflict(session, "Unknown showroom")
    return await load_user(session, user_id)
