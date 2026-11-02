from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, EmailStr, Field, HttpUrl, StringConstraints

from app.models.enums import Fuel, Role, StockStatus, Transmission
from app.schemas.auth import Password
from app.schemas.catalog import AccessoryPackOut, CityOut, ColourOut
from app.schemas.common import Name, Out, Phone, Rupees, Slug, Text

Hex = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Short = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Rate = Annotated[Decimal, Field(ge=0, le=50, max_digits=5, decimal_places=2)]
Fee = Annotated[int, Field(ge=0, le=1_00_000)]


class ColourIn(BaseModel):
    name: Short
    hex: Hex


class PackIn(BaseModel):
    name: Short
    items: list[Short] = Field(default_factory=list, max_length=20)
    price: Rupees


class ModelIn(BaseModel):
    slug: Slug
    name: Short
    body_type: Short
    tagline: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
    description: Text
    images: list[HttpUrl] = Field(default_factory=list, max_length=12)
    highlights: list[Short] = Field(default_factory=list, max_length=8)
    is_published: bool = True
    sort_order: int = 0
    colours: list[ColourIn] = Field(default_factory=list, max_length=12)
    accessory_packs: list[PackIn] = Field(default_factory=list, max_length=6)


class VariantIn(BaseModel):
    name: Short
    fuel: Fuel
    transmission: Transmission
    specs: dict[str, str] = Field(default_factory=dict, max_length=20)
    sort_order: int = 0
    is_active: bool = True


class AdminVariant(VariantIn, Out):
    id: int


class AdminModel(Out):
    id: int
    slug: str
    name: str
    body_type: str
    tagline: str
    description: str
    images: list[str]
    highlights: list[str]
    is_published: bool
    sort_order: int
    colours: list[ColourOut]
    accessory_packs: list[AccessoryPackOut]
    variants: list[AdminVariant]


class AdminModelRow(Out):
    id: int
    slug: str
    name: str
    body_type: str
    is_published: bool
    variant_count: int
    priced_cells: int


class PriceCell(BaseModel):
    variant_id: int
    city_id: int
    ex_showroom: Rupees
    valid_until: date


class GridVariant(BaseModel):
    id: int
    name: str
    fuel: Fuel
    transmission: Transmission
    is_active: bool
    prices: dict[int, PriceCell]


class PriceGrid(BaseModel):
    cities: list[CityOut]
    variants: list[GridVariant]


class SlabIn(Out):
    fuel: Fuel
    min_price: Annotated[int, Field(ge=0)]
    max_price: Annotated[int, Field(gt=0)] | None
    rate: Rate


class CityCharges(Out):
    registration_fee: Fee
    fastag_fee: Fee
    insurance_rate: Rate
    tax_slabs: list[SlabIn] = Field(max_length=40)


class AdminCity(CityCharges):
    id: int
    slug: str
    name: str


class Inspection(BaseModel):
    score: Annotated[int, Field(ge=0, le=100)]
    checked_on: date
    accident_free: bool = False
    flood_free: bool = False
    service_history: Annotated[str, StringConstraints(max_length=60)] | None = None
    items: list[dict[str, Any]] = Field(default_factory=list, max_length=60)


class UsedCarIn(BaseModel):
    stock_id: Annotated[str, StringConstraints(pattern=r"^[A-Z0-9-]{3,20}$")]
    make: Short
    model: Short
    variant: Short
    fuel: Fuel
    transmission: Transmission
    year: Annotated[int, Field(ge=2000, le=2100)]
    km: Annotated[int, Field(ge=0, le=10_00_000)]
    owners: Annotated[int, Field(ge=1, le=5)]
    colour: Short
    price: Rupees
    status: StockStatus = StockStatus.AVAILABLE
    registration_no: Annotated[
        str, StringConstraints(pattern=r"^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$")
    ]
    showroom_id: int
    images: list[HttpUrl] = Field(default_factory=list, max_length=12)
    inspection: Inspection | None = None
    description: Text = ""
    is_published: bool = True


class AdminUsedCar(Out):
    id: int
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
    colour: str
    price: int
    status: StockStatus
    registration_no: str
    showroom_id: int
    images: list[str]
    inspection: dict[str, Any]
    description: str
    is_published: bool


class UserIn(BaseModel):
    name: Name
    email: EmailStr
    phone: Phone | None = None
    password: Password
    role: Role
    showroom_id: int | None = None
    model_ids: list[int] = Field(default_factory=list)


class UserPatch(BaseModel):
    role: Role | None = None
    showroom_id: int | None = None
    is_active: bool | None = None
    model_ids: list[int] | None = None


class StaffAccount(Out):
    id: int
    name: str
    email: str
    phone: str | None
    role: Role
    showroom_id: int | None
    is_active: bool
    model_ids: list[int]
