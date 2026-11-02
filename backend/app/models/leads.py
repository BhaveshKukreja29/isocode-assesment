from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamped
from app.models.catalog import CarModel, Showroom, Variant
from app.models.enums import BookingStatus, EventKind, LeadKind, LeadSource, LeadStatus, db_enum
from app.models.used import UsedCar
from app.models.users import User


class Lead(Timestamped, Base):
    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_assignee_status", "assigned_to_id", "status"),
        Index("ix_leads_status_created", "status", "created_at"),
        Index("ix_leads_phone", "phone"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(10))
    email: Mapped[str | None] = mapped_column(String(254))
    kind: Mapped[LeadKind] = mapped_column(db_enum(LeadKind))
    source: Mapped[LeadSource] = mapped_column(db_enum(LeadSource))
    status: Mapped[LeadStatus] = mapped_column(db_enum(LeadStatus), default=LeadStatus.NEW)
    message: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict[str, Any]] = mapped_column(default=dict)  # trade-in car, portal extras
    external_ref: Mapped[str | None] = mapped_column(String(60))

    model_id: Mapped[int | None] = mapped_column(ForeignKey("car_models.id", ondelete="SET NULL"))
    used_car_id: Mapped[int | None] = mapped_column(ForeignKey("used_cars.id", ondelete="SET NULL"))
    showroom_id: Mapped[int | None] = mapped_column(ForeignKey("showrooms.id"))
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    consent_at: Mapped[datetime]
    opted_out: Mapped[bool] = mapped_column(default=False)
    assigned_at: Mapped[datetime | None]
    first_response_at: Mapped[datetime | None]

    ai_summary: Mapped[dict[str, Any] | None]
    ai_draft: Mapped[str | None] = mapped_column(Text)

    model: Mapped[CarModel | None] = relationship(lazy="joined")
    used_car: Mapped[UsedCar | None] = relationship(lazy="joined")
    showroom: Mapped[Showroom | None] = relationship(lazy="joined")
    assigned_to: Mapped[User | None] = relationship(foreign_keys=[assigned_to_id], lazy="joined")
    events: Mapped[list["LeadEvent"]] = relationship(
        cascade="all, delete-orphan", order_by="(LeadEvent.created_at, LeadEvent.id)"
    )
    test_drives: Mapped[list["TestDrive"]] = relationship(
        cascade="all, delete-orphan", order_by="TestDrive.starts_at"
    )

    @property
    def subject(self) -> str | None:
        """What the buyer is interested in, for lists and messages."""
        if self.used_car:
            car = self.used_car
            return f"{car.year} {car.make} {car.model} {car.variant}"
        return self.model.name if self.model else None

    @property
    def headline(self) -> str | None:
        return (self.ai_summary or {}).get("headline")


class LeadEvent(Timestamped, Base):
    """Append-only activity log: assignment, status changes, (mock) messages, AI runs."""

    __tablename__ = "lead_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    kind: Mapped[EventKind] = mapped_column(db_enum(EventKind))
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)

    actor: Mapped[User | None] = relationship(lazy="joined")


class DemoCar(Base):
    __tablename__ = "demo_cars"

    id: Mapped[int] = mapped_column(primary_key=True)
    showroom_id: Mapped[int] = mapped_column(ForeignKey("showrooms.id"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"))
    colour: Mapped[str] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(default=True)

    variant: Mapped[Variant] = relationship(lazy="joined")
    showroom: Mapped[Showroom] = relationship(lazy="joined")


class TestDrive(Timestamped, Base):
    __tablename__ = "test_drives"
    __table_args__ = (
        # One live booking per demo car per slot, enforced by the database.
        Index(
            "uq_test_drives_car_slot",
            "demo_car_id",
            "starts_at",
            unique=True,
            postgresql_where=text("status = 'booked'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    demo_car_id: Mapped[int] = mapped_column(ForeignKey("demo_cars.id"))
    starts_at: Mapped[datetime]
    status: Mapped[BookingStatus] = mapped_column(
        db_enum(BookingStatus), default=BookingStatus.BOOKED
    )

    demo_car: Mapped[DemoCar] = relationship(lazy="joined")
