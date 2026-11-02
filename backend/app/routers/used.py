from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import Select, func, or_, select

from app.db import contains
from app.deps import Session, not_found
from app.models import UsedCar
from app.models.enums import StockStatus
from app.routers.catalog import public_cache
from app.schemas.common import Page
from app.schemas.used import UsedCarCard, UsedCarDetail, UsedCarFilters

router = APIRouter(prefix="/used-cars", tags=["used cars"])

SORTS = {
    "newest": (UsedCar.created_at.desc(),),
    "price_asc": (UsedCar.price.asc(),),
    "price_desc": (UsedCar.price.desc(),),
    "km_asc": (UsedCar.km.asc(),),
    "year_desc": (UsedCar.year.desc(), UsedCar.km.asc()),
}


def apply_filters(stmt: Select, f: UsedCarFilters) -> Select:
    statuses = [StockStatus.AVAILABLE] + ([StockStatus.BOOKED] if f.include_booked else [])
    stmt = stmt.where(UsedCar.is_published, UsedCar.status.in_(statuses))
    if f.q:
        term = contains(f.q)
        stmt = stmt.where(
            or_(
                (UsedCar.make + " " + UsedCar.model + " " + UsedCar.variant).ilike(term),
                UsedCar.stock_id.ilike(term),
            )
        )
    if f.fuel:
        stmt = stmt.where(UsedCar.fuel.in_(f.fuel))
    if f.transmission:
        stmt = stmt.where(UsedCar.transmission == f.transmission)
    if f.min_price is not None:
        stmt = stmt.where(UsedCar.price >= f.min_price)
    if f.max_price is not None:
        stmt = stmt.where(UsedCar.price <= f.max_price)
    if f.min_year is not None:
        stmt = stmt.where(UsedCar.year >= f.min_year)
    if f.max_km is not None:
        stmt = stmt.where(UsedCar.km <= f.max_km)
    if f.max_owners is not None:
        stmt = stmt.where(UsedCar.owners <= f.max_owners)
    return stmt


@router.get("", response_model=Page[UsedCarCard])
async def list_used_cars(
    session: Session, response: Response, filters: Annotated[UsedCarFilters, Query()]
):
    public_cache(response, 30)
    stmt = apply_filters(select(UsedCar), filters)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(
        stmt.order_by(*SORTS[filters.sort], UsedCar.id)
        .offset((filters.page - 1) * filters.page_size)
        .limit(filters.page_size)
    )
    return Page(
        items=[UsedCarCard.model_validate(car) for car in rows],
        total=total or 0,
        page=filters.page,
        page_size=filters.page_size,
    )


@router.get("/{slug}", response_model=UsedCarDetail)
async def get_used_car(session: Session, response: Response, slug: str):
    public_cache(response, 30)
    car = await session.scalar(
        select(UsedCar).where(
            UsedCar.slug == slug, UsedCar.is_published, UsedCar.status != StockStatus.SOLD
        )
    )
    if car is None:
        raise not_found("This car is no longer listed")
    return car
