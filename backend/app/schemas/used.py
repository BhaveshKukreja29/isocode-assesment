from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import Fuel, StockStatus, Transmission
from app.schemas.common import Out


def mask_registration(reg: str) -> str:
    """UP32AB1234 -> UP32 •• ••34: keep the RTO and the last two digits only."""
    reg = reg.replace(" ", "").upper()
    return f"{reg[:4]} •• ••{reg[-2:]}" if len(reg) >= 6 else "••••"


class UsedCarCard(Out):
    slug: str
    stock_id: str
    make: str
    model: str
    variant: str
    fuel: Fuel
    transmission: Transmission
    year: int
    km: int
    owners: int
    price: int
    status: StockStatus
    image: str | None
    location: str


class UsedCarDetail(UsedCarCard):
    id: int
    colour: str
    images: list[str]
    inspection: dict[str, Any]
    description: str
    registration: str = Field(validation_alias="registration_no")
    showroom_id: int

    @field_validator("registration")
    @classmethod
    def _mask(cls, reg: str) -> str:
        return mask_registration(reg)


class UsedCarFilters(BaseModel):
    q: str | None = Field(None, max_length=60)
    fuel: list[Fuel] = []
    transmission: Transmission | None = None
    min_price: int | None = Field(None, ge=0)
    max_price: int | None = Field(None, ge=0)
    min_year: int | None = Field(None, ge=2000, le=2100)
    max_km: int | None = Field(None, ge=0)
    max_owners: int | None = Field(None, ge=1, le=5)
    include_booked: bool = True
    sort: Literal["newest", "price_asc", "price_desc", "km_asc", "year_desc"] = "newest"
    page: int = Field(1, ge=1, le=500)
    page_size: int = Field(12, ge=1, le=48)
