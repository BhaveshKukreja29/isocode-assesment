from decimal import Decimal

import pytest

from app.models import AccessoryPack, City, RoadTaxSlab
from app.models.enums import Fuel
from app.services.pricing import PricingError, on_road_price, percent_of


@pytest.fixture
def lucknow() -> City:
    return City(
        name="Lucknow",
        registration_fee=600,
        fastag_fee=500,
        insurance_rate=Decimal("3.50"),
        tax_slabs=[
            RoadTaxSlab(fuel=Fuel.PETROL, min_price=0, max_price=10_00_000, rate=Decimal("8")),
            RoadTaxSlab(fuel=Fuel.PETROL, min_price=10_00_000, max_price=None, rate=Decimal("10")),
            RoadTaxSlab(fuel=Fuel.ELECTRIC, min_price=0, max_price=None, rate=Decimal("0")),
        ],
    )


def amounts(price) -> dict[str, int]:
    return {item.key: item.amount for item in price.items}


def test_sample_car_model_h_zx_breakup(lucknow):
    # NEW-H-02 from the brief: ₹12,45,000 ex-showroom, petrol.
    price = on_road_price(12_45_000, Fuel.PETROL, lucknow)
    assert amounts(price) == {
        "ex_showroom": 12_45_000,
        "road_tax": 1_24_500,
        "registration": 600,
        "insurance": 43_575,
        "fastag": 500,
        "tcs": 12_450,
    }
    assert price.total == 14_26_625


def test_lower_slab_and_no_tcs_below_ten_lakh(lucknow):
    price = on_road_price(8_00_000, Fuel.PETROL, lucknow)
    items = amounts(price)
    assert items["road_tax"] == 64_000
    assert "tcs" not in items


def test_slab_boundary_belongs_to_upper_slab(lucknow):
    price = on_road_price(10_00_000, Fuel.PETROL, lucknow)
    assert amounts(price)["road_tax"] == 1_00_000
    assert "tcs" not in amounts(price)  # TCS only applies strictly above ₹10 lakh


def test_accessory_pack_is_added_with_its_name(lucknow):
    pack = AccessoryPack(name="Essentials", price=18_500)
    price = on_road_price(8_00_000, Fuel.PETROL, lucknow, pack)
    assert price.items[-1].key == "accessories"
    assert price.items[-1].label == "Essentials"
    assert price.total == on_road_price(8_00_000, Fuel.PETROL, lucknow).total + 18_500


def test_zero_rate_slab_still_listed(lucknow):
    assert amounts(on_road_price(15_00_000, Fuel.ELECTRIC, lucknow))["road_tax"] == 0


def test_missing_slab_is_an_error_not_a_guess(lucknow):
    with pytest.raises(PricingError):
        on_road_price(9_00_000, Fuel.DIESEL, lucknow)


def test_invalid_price_rejected(lucknow):
    with pytest.raises(PricingError):
        on_road_price(0, Fuel.PETROL, lucknow)


def test_percent_rounds_half_up():
    assert percent_of(1_23_450, Decimal("3.5")) == 4_321  # 4320.75
    assert percent_of(10, Decimal("5")) == 1  # 0.5 -> 1
