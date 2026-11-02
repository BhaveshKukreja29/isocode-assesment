from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import BookingStatus, EventKind, LeadKind, LeadSource, LeadStatus
from app.schemas.common import Name, Out, Phone, Slug, Text


class Contact(BaseModel):
    name: Name
    phone: Phone
    email: EmailStr | None = None
    message: Text = ""
    # DPDP Act 2023: explicit consent is required to contact the buyer.
    consent: Literal[True]


class TradeInCar(BaseModel):
    make: Name
    model: Name
    year: int = Field(ge=1995, le=2100)
    km: int = Field(ge=0, le=10_00_000)


class EnquiryIn(Contact):
    kind: Literal[LeadKind.ENQUIRY, LeadKind.USED_CAR, LeadKind.TRADE_IN] = LeadKind.ENQUIRY
    model_slug: Slug | None = None
    used_car_slug: Slug | None = None
    showroom_id: int | None = None
    trade_in: TradeInCar | None = None


class TestDriveIn(Contact):
    demo_car_id: int
    starts_at: datetime


class Slot(BaseModel):
    starts_at: datetime
    available: bool


class LeadCreated(BaseModel):
    id: int
    consultant: str | None
    test_drive_at: datetime | None = None


class Ref(Out):
    id: int
    name: str


class LeadRow(Out):
    id: int
    name: str
    phone: str
    kind: LeadKind
    source: LeadSource
    status: LeadStatus
    subject: str | None
    showroom: Ref | None
    assigned_to: Ref | None
    headline: str | None
    created_at: datetime
    first_response_at: datetime | None


class EventOut(Out):
    id: int
    kind: EventKind
    data: dict[str, Any]
    actor: Ref | None
    created_at: datetime


class TestDriveOut(Out):
    id: int
    starts_at: datetime
    status: BookingStatus
    car: str
    showroom: str


class LeadDetail(LeadRow):
    email: str | None
    message: str
    details: dict[str, Any]
    used_car_slug: str | None
    opted_out: bool
    ai_summary: dict[str, Any] | None
    ai_draft: str | None
    events: list[EventOut]
    test_drives: list[TestDriveOut]


class LeadFilters(BaseModel):
    scope: Literal["mine", "showroom", "unassigned", "all"] = "mine"
    status: list[LeadStatus] = []
    kind: LeadKind | None = None
    source: LeadSource | None = None
    q: str | None = Field(None, max_length=60)
    page: int = Field(1, ge=1, le=1000)
    page_size: int = Field(25, ge=1, le=100)


class StatusIn(BaseModel):
    status: LeadStatus


class AssignIn(BaseModel):
    user_id: int


class ContactIn(BaseModel):
    channel: Literal["whatsapp", "sms", "call"]
    body: Text = Field(min_length=2)


class InboxStats(BaseModel):
    open: int
    awaiting_reply: int
    overdue: int
    answered_in_sla_pct: float | None
    median_response_minutes: float | None
    sla_minutes: int


class RowError(BaseModel):
    row: int
    error: str


class ImportResult(BaseModel):
    created: int
    duplicates: int
    errors: list[RowError]


class ActivityItem(BaseModel):
    lead_id: int
    kind: LeadKind
    status: LeadStatus
    subject: str | None
    created_at: datetime
    test_drive_at: datetime | None
    showroom: str | None


class SlotQuery(BaseModel):
    demo_car_id: int
    day: date
