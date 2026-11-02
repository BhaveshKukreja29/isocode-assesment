"""Seed realistic sample data. Usage: `uv run python -m app.seed [--reset]`.

Built around the brief's sample stock (NEW-H-02, UC-1182, UC-1190). Everything else is
invented for the demo; see docs/TDD.md "Assumptions" for the reasoning behind numbers.
"""

import argparse
import asyncio
import os
import random
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text

from app.config import IST
from app.db import Base, SessionLocal, engine
from app.models import (
    AccessoryPack,
    CarModel,
    City,
    Colour,
    DemoCar,
    Lead,
    LeadEvent,
    RoadTaxSlab,
    Showroom,
    TestDrive,
    UsedCar,
    User,
    Variant,
    VariantPrice,
)
from app.models.enums import (
    EventKind,
    Fuel,
    LeadKind,
    LeadSource,
    LeadStatus,
    Role,
    StockStatus,
    Transmission,
)
from app.security import hash_password
from app.services.leads import apply_ai, create_lead

rng = random.Random(42)
NOW = datetime.now(UTC)
PRICE_VALID_UNTIL = date(NOW.year + (NOW.month == 12), NOW.month % 12 + 1, 1) + timedelta(days=29)

PHOTO = "https://images.unsplash.com/photo-{}".format
PHOTOS = {
    "hatch": [PHOTO("1541899481282-d53bffe3c35d"), PHOTO("1550355291-bbee04a92027")],
    "sedan": [
        PHOTO("1619767886558-efdc259cde1a"),
        PHOTO("1621007947382-bb3c3994e3fb"),
        PHOTO("1485291571150-772bcfc10da5"),
    ],
    "suv": [
        PHOTO("1617469767053-d3b523a0b982"),
        PHOTO("1533473359331-0135ef1b58bf"),
        PHOTO("1606664515524-ed2f786a0bd6"),
    ],
    "ev": [PHOTO("1606016159991-dfe4f2746ad5"), PHOTO("1590362891991-f776e747a588")],
}

M, A = Transmission.MANUAL, Transmission.AUTOMATIC
P, D, C, E = Fuel.PETROL, Fuel.DIESEL, Fuel.CNG, Fuel.ELECTRIC

# ---------------------------------------------------------------- reference data

UP_SLABS = [  # Assumption: UP charges 8% up to ₹10 lakh, 10% above; EVs exempt.
    *[(f, 0, 10_00_000, "8") for f in (P, D, C, Fuel.HYBRID)],
    *[(f, 10_00_000, None, "10") for f in (P, D, C, Fuel.HYBRID)],
    (E, 0, None, "0"),
]
DELHI_SLABS = [  # Assumption: Delhi uses three slabs and charges diesel more.
    *[(f, 0, 6_00_000, "4") for f in (P, C, Fuel.HYBRID)],
    *[(f, 6_00_000, 10_00_000, "7") for f in (P, C, Fuel.HYBRID)],
    *[(f, 10_00_000, None, "10") for f in (P, C, Fuel.HYBRID)],
    (D, 0, 6_00_000, "5"),
    (D, 6_00_000, 10_00_000, "8.75"),
    (D, 10_00_000, None, "12.5"),
    (E, 0, None, "0"),
]
CITIES = [
    # slug, name, registration+HSRP, fastag, insurance %, slabs, ex-showroom delta
    ("lucknow", "Lucknow", 2_450, 500, "3.40", UP_SLABS, 0),
    ("kanpur", "Kanpur", 2_450, 500, "3.40", UP_SLABS, 3_000),
    ("ayodhya", "Ayodhya", 2_300, 500, "3.30", UP_SLABS, 4_500),
    ("new-delhi", "New Delhi", 3_100, 500, "3.65", DELHI_SLABS, 6_000),
]

SHOWROOMS = [
    ("gomti-nagar", "Gomti Nagar", "Plot 14, Vibhuti Khand, Gomti Nagar, Lucknow 226010"),
    ("aliganj", "Aliganj", "Sector H, Kapoorthala Crossing, Aliganj, Lucknow 226024"),
    ("alambagh", "Alambagh", "Kanpur Road, near Alambagh Bus Stand, Lucknow 226005"),
]

SPEC_KEYS = ("engine", "power", "torque", "mileage", "seats", "boot", "airbags")

MODELS = [
    {
        "slug": "model-s",
        "name": "Model S",
        "body_type": "Hatchback",
        "tagline": "The city, sorted.",
        "description": "A compact hatch that parks anywhere, sips fuel and still fits five. "
        "Built for Hazratganj traffic and weekend runs to Kanpur alike.",
        "images": PHOTOS["hatch"],
        "highlights": ["6 airbags standard", "24.8 km/l (ARAI)", "Wireless Android Auto"],
        "colours": [
            ("Polar White", "#F2F2EF"),
            ("Midnight Blue", "#1C2A44"),
            ("Flame Red", "#B3261E"),
            ("Graphite", "#4A4D52"),
        ],
        "packs": [
            ("Essentials", ["Floor mats", "Mud flaps", "Body cover"], 7_900),
            ("Urban Style", ["Alloy wheel covers", "Chrome garnish", "Rear spoiler"], 18_500),
        ],
        "variants": [
            (
                "LX",
                P,
                M,
                6_49_000,
                ("1.2L 4-cyl", "82 bhp", "113 Nm", "24.8 km/l", "5", "318 L", "6"),
            ),
            (
                "VX",
                P,
                M,
                7_39_000,
                ("1.2L 4-cyl", "82 bhp", "113 Nm", "24.8 km/l", "5", "318 L", "6"),
            ),
            (
                "VX CNG",
                C,
                M,
                8_29_000,
                ("1.2L 4-cyl", "69 bhp", "95 Nm", "32.5 km/kg", "5", "220 L", "6"),
            ),
            (
                "VX AMT",
                P,
                A,
                7_89_000,
                ("1.2L 4-cyl", "82 bhp", "113 Nm", "25.4 km/l", "5", "318 L", "6"),
            ),
            (
                "ZX AMT",
                P,
                A,
                8_69_000,
                ("1.2L 4-cyl", "82 bhp", "113 Nm", "25.4 km/l", "5", "318 L", "6"),
            ),
        ],
    },
    {
        "slug": "model-c",
        "name": "Model C",
        "body_type": "Sedan",
        "tagline": "Space to stretch out.",
        "description": "A long-wheelbase sedan with a 506-litre boot and rear seats that "
        "recline. The family car that still feels special on the expressway.",
        "images": PHOTOS["sedan"],
        "highlights": ["506 L boot", "Ventilated front seats", "Level 2 ADAS on ZX"],
        "colours": [
            ("Pearl White", "#EEEDE8"),
            ("Obsidian Black", "#111214"),
            ("Lunar Silver", "#A8ABAF"),
            ("Royal Maroon", "#5A1A22"),
        ],
        "packs": [
            ("Essentials", ["Floor mats", "Mud flaps", "Body cover"], 9_500),
            ("Executive", ["Rear sunshades", "Seat covers", "Ambient lighting"], 24_900),
        ],
        "variants": [
            (
                "LX",
                P,
                M,
                9_69_000,
                ("1.5L 4-cyl", "119 bhp", "145 Nm", "17.8 km/l", "5", "506 L", "6"),
            ),
            (
                "VX CVT",
                P,
                A,
                11_89_000,
                ("1.5L 4-cyl", "119 bhp", "145 Nm", "18.4 km/l", "5", "506 L", "6"),
            ),
            (
                "VX",
                D,
                M,
                12_39_000,
                ("1.5L diesel", "99 bhp", "200 Nm", "24.1 km/l", "5", "506 L", "6"),
            ),
            (
                "ZX",
                D,
                M,
                13_49_000,
                ("1.5L diesel", "99 bhp", "200 Nm", "24.1 km/l", "5", "506 L", "6"),
            ),
        ],
    },
    {
        "slug": "model-h",
        "name": "Model H",
        "body_type": "SUV",
        "tagline": "Built for every road in UP.",
        "description": "A mid-size SUV with 210 mm ground clearance, a panoramic sunroof and "
        "a 5-star safety rating. Equally happy on the Purvanchal Expressway or a village road.",
        "images": PHOTOS["suv"],
        "highlights": ["5-star safety rating", "Panoramic sunroof", "210 mm ground clearance"],
        "colours": [
            ("Arctic White", "#F4F4F1"),
            ("Phantom Black", "#0E0F11"),
            ("Titan Grey", "#5B5F64"),
            ("Forest Green", "#2F4A3A"),
            ("Copper Bronze", "#8A5A3C"),
        ],
        "packs": [
            ("Essentials", ["3D floor mats", "Mud flaps", "Body cover"], 11_900),
            ("Adventure", ["Roof rails", "Side steps", "Skid plates", "Boot organiser"], 32_500),
        ],
        "variants": [
            (
                "LX",
                P,
                M,
                10_49_000,
                ("1.5L turbo", "113 bhp", "144 Nm", "17.4 km/l", "5", "433 L", "6"),
            ),
            (
                "VX",
                P,
                M,
                11_39_000,
                ("1.5L turbo", "113 bhp", "144 Nm", "17.4 km/l", "5", "433 L", "6"),
            ),
            # NEW-H-02 from the brief: Model H ZX automatic, petrol, ₹12,45,000 ex-showroom.
            (
                "ZX automatic",
                P,
                A,
                12_45_000,
                ("1.5L turbo", "113 bhp", "144 Nm", "16.8 km/l", "5", "433 L", "6"),
            ),
            (
                "ZX",
                D,
                M,
                13_19_000,
                ("1.5L diesel", "114 bhp", "250 Nm", "21.2 km/l", "5", "433 L", "6"),
            ),
            (
                "ZX+ automatic",
                D,
                A,
                14_59_000,
                ("1.5L diesel", "114 bhp", "250 Nm", "19.1 km/l", "5", "433 L", "6"),
            ),
        ],
    },
    {
        "slug": "model-e",
        "name": "Model E",
        "body_type": "Electric crossover",
        "tagline": "Quiet. Quick. Zero road tax in UP.",
        "description": "An electric crossover with up to 465 km of range and DC fast charging "
        "from 10 to 80% in 40 minutes. Home charger installation included.",
        "images": PHOTOS["ev"],
        "highlights": ["Up to 465 km range (MIDC)", "10–80% in 40 min", "Home charger included"],
        "colours": [
            ("Glacier White", "#F5F6F4"),
            ("Electric Teal", "#1F6F72"),
            ("Carbon Black", "#16171A"),
        ],
        "packs": [
            ("Essentials", ["Floor mats", "Portable charger", "Body cover"], 14_900),
        ],
        "variants": [
            (
                "Standard Range",
                E,
                A,
                15_49_000,
                ("38 kWh", "134 bhp", "255 Nm", "375 km", "5", "380 L", "6"),
            ),
            (
                "Long Range",
                E,
                A,
                17_99_000,
                ("50 kWh", "148 bhp", "255 Nm", "465 km", "5", "380 L", "6"),
            ),
        ],
    },
]

STAFF = [
    # name, email, role, showroom index, models (empty = all)
    ("Neha Kapoor", "admin@demo.in", Role.ADMIN, None, []),
    ("Aman Verma", "aman@demo.in", Role.CONSULTANT, 0, ["model-h", "model-e"]),
    ("Priya Singh", "priya@demo.in", Role.CONSULTANT, 0, []),
    ("Rohit Mishra", "rohit@demo.in", Role.CONSULTANT, 1, ["model-s", "model-c"]),
    ("Sana Khan", "sana@demo.in", Role.CONSULTANT, 1, []),
    ("Vikas Yadav", "vikas@demo.in", Role.CONSULTANT, 2, []),
    ("Pooja Tiwari", "pooja@demo.in", Role.CONSULTANT, 2, ["model-h", "model-c"]),
]
BUYER = ("Ritika Sharma", "buyer@demo.in", "9876501234")

DEMO_CARS = {  # showroom index -> (model slug, variant name, colour)
    0: [
        ("model-h", "ZX automatic", "Arctic White"),
        ("model-c", "VX CVT", "Lunar Silver"),
        ("model-s", "VX AMT", "Flame Red"),
        ("model-e", "Long Range", "Electric Teal"),
    ],
    1: [
        ("model-h", "VX", "Titan Grey"),
        ("model-s", "ZX AMT", "Midnight Blue"),
        ("model-c", "ZX", "Obsidian Black"),
    ],
    2: [
        ("model-h", "ZX", "Forest Green"),
        ("model-s", "LX", "Polar White"),
        ("model-e", "Standard Range", "Glacier White"),
    ],
}

# ---------------------------------------------------------------- leads

LEADS = [
    # name, phone, kind, source, model slug, message, minutes ago, outcome
    (
        "Ritika Sharma",
        "9876501234",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-h",
        "Looking for an automatic petrol SUV around 13 lakh. Need a loan, want delivery before "
        "Diwali. Have a 2017 hatchback to exchange.",
        3,
        None,
    ),
    (
        "Arjun Mehta",
        "9811122233",
        LeadKind.ENQUIRY,
        LeadSource.PORTAL,
        "model-c",
        "Diesel sedan for highway use, mostly Lucknow–Delhi. Budget 13.5 lakh, paying cash.",
        7,
        None,
    ),
    (
        "Farhan Ali",
        "9935012345",
        LeadKind.ENQUIRY,
        LeadSource.SOCIAL,
        "model-e",
        "EV ka range kitna hai real world mein? Office 30 km daily. Home charger milega?",
        12,
        None,
    ),
    (
        "Kavya Srivastava",
        "9453098765",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-s",
        "First car, need something easy to drive in traffic. Automatic preferred. Budget 8 lakh.",
        26,
        None,
    ),
    (
        "Deepak Pandey",
        "9721456789",
        LeadKind.TRADE_IN,
        LeadSource.WEBSITE,
        "model-h",
        "Want to exchange my old car for Model H.",
        41,
        None,
    ),
    ("Shalini Gupta", "8840123456", LeadKind.ENQUIRY, LeadSource.PORTAL, None, "call me", 55, None),
    (
        "Imran Siddiqui",
        "9415567890",
        LeadKind.ENQUIRY,
        LeadSource.PORTAL,
        "model-h",
        "Family of 5, need sunroof and safety. Looking at diesel automatic. This month.",
        95,
        ("contacted", 4),
    ),
    (
        "Ankita Rastogi",
        "9670011223",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-c",
        "Is the CVT smooth in city traffic? Need EMI options.",
        180,
        ("contacted", 3),
    ),
    (
        "Sandeep Chauhan",
        "9506677889",
        LeadKind.ENQUIRY,
        LeadSource.SOCIAL,
        "model-s",
        "CNG variant available? Mileage is most important for me, I drive a lot.",
        320,
        ("negotiation", 9),
    ),
    (
        "Meera Joshi",
        "9838844556",
        LeadKind.ENQUIRY,
        LeadSource.WALK_IN,
        "model-e",
        "Saw the car at Gomti Nagar. Wants long range, white colour.",
        600,
        ("contacted", 2),
    ),
    (
        "Rahul Tripathi",
        "9554433221",
        LeadKind.ENQUIRY,
        LeadSource.PORTAL,
        "model-h",
        "Just exploring options for next year.",
        1_400,
        ("lost", 38),
    ),
    (
        "Neelam Saxena",
        "9889900112",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-c",
        "Petrol automatic sedan under 12 lakh. Ready to book this week.",
        2_100,
        ("won", 3),
    ),
    (
        "Vivek Dubey",
        "9919988776",
        LeadKind.ENQUIRY,
        LeadSource.PORTAL,
        "model-s",
        "Need a second car for my wife. Manual is fine. Under 7 lakh.",
        2_900,
        ("contacted", 12),
    ),
    (
        "Ayesha Rizvi",
        "9161122334",
        LeadKind.ENQUIRY,
        LeadSource.SOCIAL,
        "model-h",
        "Price for ZX automatic on-road Kanpur?",
        3_600,
        ("contacted", 6),
    ),
    (
        "Gaurav Agarwal",
        "9792233445",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-e",
        "Corporate lease possible? Want 2 units for our office.",
        4_300,
        ("negotiation", 2),
    ),
    (
        "Pankaj Shukla",
        "9026655443",
        LeadKind.ENQUIRY,
        LeadSource.PORTAL,
        "model-c",
        "",
        5_800,
        ("contacted", 22),
    ),
    (
        "Swati Bajpai",
        "8960112233",
        LeadKind.ENQUIRY,
        LeadSource.WEBSITE,
        "model-s",
        "Looking for red colour hatchback with sunroof, budget 9 lakh, need loan.",
        7_200,
        ("won", 4),
    ),
]
USED_LEADS = [
    (
        "Manish Kumar",
        "9451239876",
        "UC-1182",
        "Is this diesel sedan still available? Can I see "
        "the service history? Will pay cash if the car is good.",
        18,
        None,
    ),
    (
        "Rekha Verma",
        "9305566778",
        "UC-1190",
        "Interested in this car for my daughter. Any accident history?",
        860,
        ("contacted", 7),
    ),
]
TEST_DRIVE_LEADS = [
    # name, phone, showroom index, demo index, days ahead, hour, message
    ("Nikhil Rao", "9839012345", 0, 0, 1, 11, "Want to compare with the diesel."),
    ("Prachi Dixit", "9628011223", 0, 1, 1, 15, ""),
    ("Harsh Vardhan", "9412233440", 1, 0, 2, 12, "Bringing my father along."),
    ("Tanvi Mathur", "9554012399", 2, 2, 3, 17, "Interested in home charging setup."),
]

# ---------------------------------------------------------------- used stock

USED_SAMPLES = [
    # The brief's sample rows, kept verbatim.
    ("UC-1182", "model-c", "VX", D, M, 2022, 41_200, 8_45_000, StockStatus.AVAILABLE, 1),
    ("UC-1190", "model-s", "LX", P, M, 2021, 58_600, 5_12_000, StockStatus.BOOKED, 1),
]
INSPECTION_AREAS = [
    "Engine",
    "Transmission",
    "Suspension",
    "Brakes",
    "Tyres",
    "Electricals",
    "Air conditioning",
    "Body & paint",
    "Interior",
    "Documents",
]
ATTENTION_NOTES = {
    "Tyres": "Front tyres at 40%, replacement advised within 8,000 km",
    "Body & paint": "Minor scratch on rear bumper, touched up",
    "Interior": "Light wear on driver seat bolster",
    "Brakes": "Rear pads at 35%",
    "Suspension": "Slight noise over speed breakers, bushings checked",
}
COLOURS = ["White", "Silver", "Grey", "Black", "Red", "Blue", "Maroon"]


def inspection(rng_: random.Random, year: int) -> dict:
    flagged = set(rng_.sample(sorted(ATTENTION_NOTES), k=rng_.randint(0, 2)))
    items = [
        {
            "area": area,
            "status": "attention" if area in flagged else "ok",
            "note": ATTENTION_NOTES[area] if area in flagged else "Checked, no issues",
        }
        for area in INSPECTION_AREAS
    ]
    return {
        "score": 96 - 5 * len(flagged) - max(0, 2023 - year) - rng_.randint(0, 3),
        "checked_on": (NOW.date() - timedelta(days=rng_.randint(2, 40))).isoformat(),
        "accident_free": True,
        "flood_free": True,
        "service_history": "Authorised workshop" if rng_.random() > 0.2 else "Partial records",
        "items": items,
    }


def used_price(new_price: int, year: int, km: int, owners: int) -> int:
    age = max(0, NOW.year - year)
    value = new_price * 0.86**age * (1 - min(km, 1_50_000) / 1_000_000) * (1 - 0.04 * (owners - 1))
    return int(round(value / 5_000) * 5_000)


def registration(rng_: random.Random) -> str:
    rto = rng_.choice(["32", "32", "32", "78", "42", "41"])  # Lucknow, Kanpur, Ayodhya, Barabanki
    letters = "".join(rng_.choice("ABCDEFGHJKLMNPRSTUVWXYZ") for _ in range(2))
    return f"UP{rto}{letters}{rng_.randint(1000, 9999)}"


def slugify(*parts) -> str:
    words = " ".join(str(p) for p in parts).split()
    return "-".join("".join(ch for ch in w.lower() if ch.isalnum()) for w in words)


# ---------------------------------------------------------------- seeding


async def seed(reset: bool) -> None:
    async with engine.begin() as conn:
        if reset:
            tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))

    async with SessionLocal() as session:
        if await session.scalar(select(func.count()).select_from(City)):
            print("Database already has data. Re-run with --reset to wipe and reseed.")
            return

        password = hash_password(os.environ.get("SEED_PASSWORD", "Demo@1234"))

        cities = []
        for slug, name, reg, tag, ins, slabs, _ in CITIES:
            city = City(
                slug=slug,
                name=name,
                registration_fee=reg,
                fastag_fee=tag,
                insurance_rate=Decimal(ins),
                tax_slabs=[
                    RoadTaxSlab(fuel=f, min_price=lo, max_price=hi, rate=Decimal(r))
                    for f, lo, hi, r in slabs
                ],
            )
            cities.append(city)
        session.add_all(cities)
        await session.flush()

        showrooms = [
            Showroom(
                slug=slug,
                name=name,
                city_id=cities[0].id,
                address=address,
                phone=f"0522-40000{i + 1:02d}",
                opens_at=time(10),
                closes_at=time(19),
            )
            for i, (slug, name, address) in enumerate(SHOWROOMS)
        ]
        session.add_all(showrooms)

        models: dict[str, CarModel] = {}
        base_prices: dict[tuple[str, str], int] = {}
        for order, spec in enumerate(MODELS):
            model = CarModel(
                slug=spec["slug"],
                name=spec["name"],
                body_type=spec["body_type"],
                tagline=spec["tagline"],
                description=spec["description"],
                images=spec["images"],
                highlights=spec["highlights"],
                sort_order=order,
                colours=[Colour(name=n, hex=h) for n, h in spec["colours"]],
                accessory_packs=[
                    AccessoryPack(name=n, items=items, price=p) for n, items, p in spec["packs"]
                ],
                variants=[
                    Variant(
                        name=name,
                        fuel=fuel,
                        transmission=tx,
                        sort_order=i,
                        specs=dict(zip(SPEC_KEYS, specs, strict=True)),
                    )
                    for i, (name, fuel, tx, _, specs) in enumerate(spec["variants"])
                ],
            )
            models[spec["slug"]] = model
            for name, *_, price, _specs in spec["variants"]:
                base_prices[(spec["slug"], name)] = price
        session.add_all(models.values())
        await session.flush()

        for slug, model in models.items():
            for variant in model.variants:
                for city, (*_, delta) in zip(cities, CITIES, strict=True):
                    session.add(
                        VariantPrice(
                            variant_id=variant.id,
                            city_id=city.id,
                            ex_showroom=base_prices[(slug, variant.name)] + delta,
                            valid_until=PRICE_VALID_UNTIL,
                        )
                    )

        for name, email, role, showroom_idx, model_slugs in STAFF:
            session.add(
                User(
                    name=name,
                    email=email,
                    phone=None,
                    password_hash=password,
                    role=role,
                    showroom_id=showrooms[showroom_idx].id if showroom_idx is not None else None,
                    models=[models[s] for s in model_slugs],
                )
            )
        buyer = User(
            name=BUYER[0], email=BUYER[1], phone=BUYER[2], password_hash=password, role=Role.BUYER
        )
        session.add(buyer)

        demo_cars: dict[int, list[DemoCar]] = {}
        for idx, cars in DEMO_CARS.items():
            demo_cars[idx] = []
            for slug, variant_name, colour in cars:
                variant = next(v for v in models[slug].variants if v.name == variant_name)
                demo = DemoCar(showroom_id=showrooms[idx].id, variant_id=variant.id, colour=colour)
                demo_cars[idx].append(demo)
                session.add(demo)

        used_cars = seed_used_cars(models, base_prices, showrooms)
        session.add_all(used_cars)
        await session.flush()
        used_by_stock = {car.stock_id: car for car in used_cars}

        leads: list[Lead] = []
        for name, phone, kind, source, slug, message, ago, outcome in LEADS:
            lead = Lead(
                name=name,
                phone=phone,
                kind=kind,
                source=source,
                message=message,
                model_id=models[slug].id if slug else None,
                showroom_id=None if source == LeadSource.PORTAL else showrooms[ago % 3].id,
                buyer_id=buyer.id if phone == buyer.phone else None,
                details={
                    "trade_in": {"make": "Brand X", "model": "Model S", "year": 2017, "km": 68_000}
                }
                if kind == LeadKind.TRADE_IN
                else {},
            )
            leads.append(await add_lead(session, lead, ago, outcome))

        for name, phone, stock_id, message, ago, outcome in USED_LEADS:
            car = used_by_stock[stock_id]
            lead = Lead(
                name=name,
                phone=phone,
                kind=LeadKind.USED_CAR,
                source=LeadSource.WEBSITE,
                message=message,
                used_car_id=car.id,
                showroom_id=car.showroom_id,
            )
            leads.append(await add_lead(session, lead, ago, outcome))

        for name, phone, s_idx, d_idx, days, hour, message in TEST_DRIVE_LEADS:
            demo = demo_cars[s_idx][d_idx]
            variant = await session.get(Variant, demo.variant_id)
            starts = datetime.combine(
                NOW.astimezone(IST).date() + timedelta(days=days), time(hour), IST
            )
            lead = Lead(
                name=name,
                phone=phone,
                kind=LeadKind.TEST_DRIVE,
                status=LeadStatus.TEST_DRIVE,
                source=LeadSource.WEBSITE,
                message=message,
                model_id=variant.model_id,
                showroom_id=demo.showroom_id,
            )
            lead = await add_lead(session, lead, 60 * days + 30, ("test_drive", 3))
            session.add(TestDrive(lead_id=lead.id, demo_car_id=demo.id, starts_at=starts))
            leads.append(lead)

        await session.flush()
        for lead in leads:
            lead = await session.get(Lead, lead.id, populate_existing=True)
            await apply_ai(session, lead, use_llm=False)
        # Events default to now(); line them up with the back-dated leads.
        await session.execute(
            text(
                "UPDATE lead_events e SET created_at = l.created_at + interval '5 seconds' "
                "FROM leads l WHERE e.lead_id = l.id AND e.created_at >= :now"
            ),
            {"now": NOW},
        )
        await session.commit()

    print(
        f"Seeded {len(cities)} cities, {len(showrooms)} showrooms, {len(models)} models, "
        f"{len(used_cars)} used cars, {len(leads)} leads. Password for demo users: "
        f"{'$SEED_PASSWORD' if 'SEED_PASSWORD' in os.environ else 'Demo@1234'}"
    )


CALL_NOTES = {
    "contacted": "Called. Shared variant options; buyer will visit the showroom this weekend.",
    "negotiation": "Called. Buyer has seen the on-road breakup and is comparing finance options.",
    "test_drive": "Called to confirm the test drive and asked for driving licence on arrival.",
    "won": "Called. Booking confirmed at the showroom.",
    "lost": "Called. Buyer has postponed the purchase to next year.",
}


async def add_lead(session, lead: Lead, minutes_ago: int, outcome) -> Lead:
    created = NOW - timedelta(minutes=minutes_ago)
    lead.created_at = created
    lead.consent_at = created
    await create_lead(session, lead)
    lead.assigned_at = created
    if outcome:
        status, response_minutes = outcome
        lead.status = LeadStatus(status)
        lead.first_response_at = created + timedelta(minutes=response_minutes)
        session.add(
            LeadEvent(
                lead_id=lead.id,
                actor_id=lead.assigned_to_id,
                kind=EventKind.MESSAGE,
                data={"channel": "call", "body": CALL_NOTES[status]},
                created_at=lead.first_response_at,
            )
        )
    await session.flush()
    return lead


def seed_used_cars(models, base_prices, showrooms) -> list[UsedCar]:
    rows = list(USED_SAMPLES)
    variants = [
        (slug, v[0], v[1], v[2])
        for slug in models
        for v in next(m["variants"] for m in MODELS if m["slug"] == slug)
    ]
    for i in range(46):
        slug, variant, fuel, tx = rng.choice(variants)
        year = rng.randint(2022 if fuel == E else 2016, 2024)
        km = max(3_000, int((NOW.year - year) * rng.uniform(6_500, 15_000)))
        owners = 1 if rng.random() < 0.7 else rng.choice([2, 2, 3])
        price = used_price(base_prices[(slug, variant)], year, km, owners)
        status = rng.choices(
            [StockStatus.AVAILABLE, StockStatus.BOOKED, StockStatus.SOLD], [80, 14, 6]
        )[0]
        rows.append(
            (f"UC-{1200 + i * 7}", slug, variant, fuel, tx, year, km, price, status, owners)
        )

    cars = []
    for idx, (stock, slug, variant, fuel, tx, year, km, price, status, owners) in enumerate(rows):
        model = models[slug]
        photos = PHOTOS[
            {"Hatchback": "hatch", "Sedan": "sedan", "SUV": "suv"}.get(model.body_type, "ev")
        ]
        cars.append(
            UsedCar(
                stock_id=stock,
                slug=slugify(year, "Brand X", model.name, variant, stock),
                make="Brand X",
                model=model.name,
                variant=variant,
                fuel=fuel,
                transmission=tx,
                year=year,
                km=km,
                owners=owners,
                colour=rng.choice(COLOURS),
                price=price,
                status=status,
                registration_no=registration(rng),
                showroom_id=showrooms[2 if idx % 3 else rng.randrange(3)].id,
                images=rng.sample(photos, k=len(photos)),
                inspection=inspection(rng, year),
                description=f"{'Single' if owners == 1 else 'Second' if owners == 2 else 'Third'}"
                f"-owner {model.name} {variant}, {km:,} km. Certified after a 140-point "
                "inspection, with 1-year warranty and free RC transfer.",
                created_at=NOW - timedelta(days=rng.randint(0, 60), hours=rng.randint(0, 23)),
            )
        )
    return cars


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="wipe all tables first")
    asyncio.run(seed(parser.parse_args().reset))
