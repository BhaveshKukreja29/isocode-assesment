from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import Session, not_found
from app.models import (
    AccessoryPack,
    CarModel,
    City,
    DemoCar,
    Showroom,
    Variant,
    VariantPrice,
)
from app.schemas.catalog import (
    CityOut,
    DemoCarOut,
    ModelCard,
    ModelDetail,
    PriceBreakup,
    ShowroomOut,
    VariantOut,
)
from app.services.pricing import PricingError, on_road_price

router = APIRouter(tags=["catalog"])

DEFAULT_CITY = "lucknow"
MODEL_FIELDS = (
    "id",
    "slug",
    "name",
    "body_type",
    "tagline",
    "description",
    "images",
    "highlights",
    "colours",
    "accessory_packs",
)
CitySlug = Annotated[str, Query(pattern=r"^[a-z0-9-]{1,60}$")]


def public_cache(response: Response, seconds: int = 60) -> None:
    response.headers["Cache-Control"] = f"public, max-age={seconds}, stale-while-revalidate=300"


async def get_city(session: Session, slug: str, *, with_slabs: bool = False) -> City:
    stmt = select(City).where(City.slug == slug)
    if with_slabs:
        stmt = stmt.options(selectinload(City.tax_slabs))
    city = await session.scalar(stmt)
    if city is None:
        raise not_found("We don't have prices for that city yet")
    return city


async def get_published_model(session: Session, slug: str, *options) -> CarModel:
    model = await session.scalar(
        select(CarModel).where(CarModel.slug == slug, CarModel.is_published).options(*options)
    )
    if model is None:
        raise not_found("Model not found")
    return model


@router.get("/cities", response_model=list[CityOut])
async def list_cities(session: Session, response: Response):
    public_cache(response, 600)
    return (await session.scalars(select(City).order_by(City.name))).all()


@router.get("/showrooms", response_model=list[ShowroomOut])
async def list_showrooms(session: Session, response: Response):
    public_cache(response, 600)
    return (await session.scalars(select(Showroom).order_by(Showroom.id))).all()


@router.get("/models", response_model=list[ModelCard])
async def list_models(session: Session, response: Response, city: CitySlug = DEFAULT_CITY):
    public_cache(response)
    city_row = await get_city(session, city)
    from_prices = dict(
        (
            await session.execute(
                select(Variant.model_id, func.min(VariantPrice.ex_showroom))
                .join(VariantPrice)
                .where(VariantPrice.city_id == city_row.id, Variant.is_active)
                .group_by(Variant.model_id)
            )
        ).all()
    )
    models = await session.scalars(
        select(CarModel)
        .where(CarModel.is_published)
        .options(selectinload(CarModel.variants))
        .order_by(CarModel.sort_order, CarModel.name)
    )
    return [
        ModelCard(
            slug=m.slug,
            name=m.name,
            body_type=m.body_type,
            tagline=m.tagline,
            image=m.images[0] if m.images else None,
            from_price=from_prices.get(m.id),
            fuels=sorted({v.fuel for v in m.variants if v.is_active}),
            transmissions=sorted({v.transmission for v in m.variants if v.is_active}),
        )
        for m in models
    ]


@router.get("/models/{slug}", response_model=ModelDetail)
async def get_model(session: Session, response: Response, slug: str, city: CitySlug = DEFAULT_CITY):
    public_cache(response)
    city_row = await get_city(session, city)
    model = await get_published_model(
        session,
        slug,
        selectinload(CarModel.variants),
        selectinload(CarModel.colours),
        selectinload(CarModel.accessory_packs),
    )
    variants = [v for v in model.variants if v.is_active]
    prices = {
        p.variant_id: p
        for p in await session.scalars(
            select(VariantPrice).where(
                VariantPrice.city_id == city_row.id,
                VariantPrice.variant_id.in_([v.id for v in variants]),
            )
        )
    }
    return ModelDetail.model_validate(
        {
            **{field: getattr(model, field) for field in MODEL_FIELDS},
            "city": city_row,
            "variants": [
                VariantOut.model_validate(v).model_copy(
                    update={
                        "ex_showroom": prices[v.id].ex_showroom if v.id in prices else None,
                        "valid_until": prices[v.id].valid_until if v.id in prices else None,
                    }
                )
                for v in variants
            ],
        },
        from_attributes=True,
    )


@router.get("/models/{slug}/price", response_model=PriceBreakup)
async def get_price(
    session: Session,
    response: Response,
    slug: str,
    variant_id: int,
    city: CitySlug = DEFAULT_CITY,
    pack_id: int | None = None,
):
    public_cache(response)
    model = await get_published_model(session, slug)
    variant = await session.get(Variant, variant_id)
    if variant is None or variant.model_id != model.id or not variant.is_active:
        raise not_found("Variant not found")
    city_row = await get_city(session, city, with_slabs=True)
    price = await session.scalar(
        select(VariantPrice).where(
            VariantPrice.variant_id == variant.id, VariantPrice.city_id == city_row.id
        )
    )
    if price is None:
        raise not_found(f"{variant.name} isn't priced for {city_row.name} yet")

    pack = None
    if pack_id is not None:
        pack = await session.get(AccessoryPack, pack_id)
        if pack is None or pack.model_id != model.id:
            raise not_found("Accessory pack not found")

    try:
        breakup = on_road_price(price.ex_showroom, variant.fuel, city_row, pack)
    except PricingError as exc:
        raise HTTPException(409, str(exc)) from exc
    return PriceBreakup(
        variant_id=variant.id,
        city=CityOut.model_validate(city_row),
        items=breakup.items,
        total=breakup.total,
        valid_until=price.valid_until,
    )


@router.get("/models/{slug}/demo-cars", response_model=list[DemoCarOut])
async def list_demo_cars(session: Session, slug: str, showroom_id: int | None = None):
    model = await get_published_model(session, slug)
    stmt = (
        select(DemoCar)
        .join(DemoCar.variant)
        .where(Variant.model_id == model.id, DemoCar.is_active, Variant.is_active)
        .order_by(DemoCar.showroom_id, Variant.sort_order)
    )
    if showroom_id is not None:
        stmt = stmt.where(DemoCar.showroom_id == showroom_id)
    return (await session.scalars(stmt)).all()
