"""Outbound WhatsApp/SMS. Mocked: messages are logged and stored on the lead timeline only.

Swap the body of `send` for a real provider (Gupshup, MSG91, WhatsApp Cloud API) when
going live; callers do not change.
"""

import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import IST
from app.models import Lead, LeadEvent
from app.models.enums import EventKind

log = logging.getLogger(__name__)

DEALER_NAME = "Company A"


def first_name(full_name: str) -> str:
    return full_name.split()[0] if full_name.strip() else "there"


def acknowledgement(lead: Lead, model_name: str | None, consultant_name: str | None) -> str:
    about = f" about the {model_name}" if model_name else ""
    who = (
        f"{consultant_name} from {DEALER_NAME}" if consultant_name else f"Our team at {DEALER_NAME}"
    )
    return (
        f"Hi {first_name(lead.name)}, thanks for your enquiry{about}. {who} will call you "
        f"shortly. Reply STOP to opt out."
    )


def format_slot(starts_at: datetime) -> str:
    return starts_at.astimezone(IST).strftime("%a %d %b, %I:%M %p")


def test_drive_confirmation(lead: Lead, starts_at: datetime, showroom_name: str) -> str:
    return (
        f"Hi {first_name(lead.name)}, your test drive is booked for {format_slot(starts_at)} "
        f"at {DEALER_NAME} {showroom_name}."
    )


def send(
    session: AsyncSession,
    lead: Lead,
    body: str,
    actor_id: int | None = None,
    channel: str = "whatsapp",
) -> bool:
    """Record an outbound message on the lead timeline. Respects the DPDP opt-out."""
    if lead.opted_out:
        return False
    log.info("mock %s to lead %s: %s", channel, lead.id, body)
    session.add(
        LeadEvent(
            lead_id=lead.id,
            actor_id=actor_id,
            kind=EventKind.MESSAGE,
            data={"channel": channel, "body": body, "delivery": "mock"},
        )
    )
    return True
