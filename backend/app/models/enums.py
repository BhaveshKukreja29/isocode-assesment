from enum import StrEnum

from sqlalchemy import Enum


def db_enum(enum_cls: type[StrEnum]) -> Enum:
    """Store enums as VARCHAR + CHECK so adding a value is a one-line migration."""
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class Role(StrEnum):
    BUYER = "buyer"
    CONSULTANT = "consultant"
    ADMIN = "admin"


class Fuel(StrEnum):
    PETROL = "petrol"
    DIESEL = "diesel"
    CNG = "cng"
    HYBRID = "hybrid"
    ELECTRIC = "electric"


class Transmission(StrEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class StockStatus(StrEnum):
    AVAILABLE = "available"
    BOOKED = "booked"
    SOLD = "sold"


class LeadKind(StrEnum):
    ENQUIRY = "enquiry"
    TEST_DRIVE = "test_drive"
    USED_CAR = "used_car"
    TRADE_IN = "trade_in"


class LeadSource(StrEnum):
    WEBSITE = "website"
    PORTAL = "portal"
    SOCIAL = "social"
    WALK_IN = "walk_in"


class LeadStatus(StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    TEST_DRIVE = "test_drive"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class BookingStatus(StrEnum):
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class EventKind(StrEnum):
    CREATED = "created"
    ASSIGNED = "assigned"
    REASSIGNED = "reassigned"
    STATUS = "status"
    MESSAGE = "message"
    AI = "ai"
