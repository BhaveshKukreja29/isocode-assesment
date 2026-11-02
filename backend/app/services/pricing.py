"""On-road price = ex-showroom + road tax + registration + insurance + FASTag + TCS + accessories.

Every input comes from admin-managed tables (variant_prices, cities, road_tax_slabs,
accessory_packs). Nothing here is hard-coded per car, so admins can change prices
without a deploy. All amounts are whole rupees.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.models import AccessoryPack, City
from app.models.enums import Fuel

# Income Tax Act s.206C(1F): 1% TCS on motor vehicles above ₹10 lakh.
TCS_THRESHOLD = 10_00_000
TCS_RATE = Decimal("1")


class PricingError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class LineItem:
    key: str
    amount: int
    rate: Decimal | None = None
    label: str | None = None


@dataclass(frozen=True, slots=True)
class OnRoadPrice:
    items: list[LineItem]

    @property
    def total(self) -> int:
        return sum(item.amount for item in self.items)


def percent_of(amount: int, rate: Decimal) -> int:
    return int((Decimal(amount) * rate / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def road_tax_rate(city: City, fuel: Fuel, ex_showroom: int) -> Decimal:
    for slab in city.tax_slabs:
        in_range = slab.min_price <= ex_showroom and (
            slab.max_price is None or ex_showroom < slab.max_price
        )
        if slab.fuel == fuel and in_range:
            return slab.rate
    raise PricingError(f"No road-tax slab in {city.name} for {fuel} at ₹{ex_showroom}")


def on_road_price(
    ex_showroom: int, fuel: Fuel, city: City, pack: AccessoryPack | None = None
) -> OnRoadPrice:
    if ex_showroom <= 0:
        raise PricingError("Ex-showroom price must be positive")

    tax_rate = road_tax_rate(city, fuel, ex_showroom)
    items = [
        LineItem("ex_showroom", ex_showroom),
        LineItem("road_tax", percent_of(ex_showroom, tax_rate), tax_rate),
        LineItem("registration", city.registration_fee),
        LineItem("insurance", percent_of(ex_showroom, city.insurance_rate), city.insurance_rate),
        LineItem("fastag", city.fastag_fee),
    ]
    if ex_showroom > TCS_THRESHOLD:
        items.append(LineItem("tcs", percent_of(ex_showroom, TCS_RATE), TCS_RATE))
    if pack:
        items.append(LineItem("accessories", pack.price, label=pack.name))
    return OnRoadPrice(items)
