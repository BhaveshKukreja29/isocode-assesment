from datetime import date, time
from decimal import Decimal
from typing import Any

from app.models.enums import Fuel, Transmission
from app.schemas.common import Out


class CityOut(Out):
    id: int
    slug: str
    name: str


class ShowroomOut(Out):
    id: int
    slug: str
    name: str
    address: str
    phone: str
    opens_at: time
    closes_at: time
    city: CityOut


class ModelCard(Out):
    slug: str
    name: str
    body_type: str
    tagline: str
    image: str | None
    from_price: int | None
    fuels: list[Fuel]
    transmissions: list[Transmission]


class VariantOut(Out):
    id: int
    name: str
    fuel: Fuel
    transmission: Transmission
    specs: dict[str, Any]
    ex_showroom: int | None = None
    valid_until: date | None = None


class ColourOut(Out):
    name: str
    hex: str


class AccessoryPackOut(Out):
    id: int
    name: str
    items: list[str]
    price: int


class ModelDetail(Out):
    id: int
    slug: str
    name: str
    body_type: str
    tagline: str
    description: str
    images: list[str]
    highlights: list[str]
    variants: list[VariantOut]
    colours: list[ColourOut]
    accessory_packs: list[AccessoryPackOut]
    city: CityOut


class PriceLine(Out):
    key: str
    amount: int
    rate: Decimal | None = None
    label: str | None = None


class PriceBreakup(Out):
    variant_id: int
    city: CityOut
    items: list[PriceLine]
    total: int
    valid_until: date


class DemoCarOut(Out):
    id: int
    colour: str
    showroom_id: int
    variant: VariantOut
