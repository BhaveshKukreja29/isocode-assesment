"""Lead lifecycle: create -> auto-assign -> acknowledge -> AI summary (background)."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import SessionLocal
from app.models import Lead, LeadEvent, TestDrive, User
from app.models.enums import BookingStatus, EventKind
from app.services import ai, messaging
from app.services.assignment import auto_assign

log = logging.getLogger(__name__)


def add_event(
    session: AsyncSession, lead: Lead, kind: EventKind, actor_id: int | None = None, **data
) -> None:
    session.add(LeadEvent(lead_id=lead.id, kind=kind, actor_id=actor_id, data=data))


async def create_lead(
    session: AsyncSession, lead: Lead, *, acknowledge: bool = True
) -> User | None:
    """Persist, assign and acknowledge a lead in the caller's transaction.

    Returns the assigned consultant. The caller commits, then schedules `summarise_lead`.
    """
    session.add(lead)
    await session.flush()
    add_event(session, lead, EventKind.CREATED, source=lead.source.value)

    consultant_id = await auto_assign(session, lead)
    consultant = await session.get(User, consultant_id) if consultant_id else None
    if consultant:
        add_event(session, lead, EventKind.ASSIGNED, to=consultant.name, auto=True)

    if acknowledge:
        await session.refresh(lead, ["model"])
        model_name = lead.model.name if lead.model else None
        body = messaging.acknowledgement(lead, model_name, consultant.name if consultant else None)
        messaging.send(session, lead, body)
    return consultant


async def load_lead(session: AsyncSession, lead_id: int) -> Lead | None:
    return await session.scalar(
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.events).joinedload(LeadEvent.actor))
    )


async def upcoming_test_drive(session: AsyncSession, lead_id: int) -> TestDrive | None:
    return await session.scalar(
        select(TestDrive)
        .where(TestDrive.lead_id == lead_id, TestDrive.status == BookingStatus.BOOKED)
        .order_by(TestDrive.starts_at)
        .limit(1)
    )


async def build_context(session: AsyncSession, lead: Lead) -> ai.LeadContext:
    drive = await upcoming_test_drive(session, lead.id)
    used = lead.used_car
    return ai.LeadContext(
        name=lead.name,
        kind=lead.kind.value,
        source=lead.source.value,
        message=lead.message,
        model=lead.model.name if lead.model else None,
        used_car=f"{used.year} {used.make} {used.model} {used.variant}" if used else None,
        showroom=lead.showroom.name if lead.showroom else None,
        consultant=lead.assigned_to.name if lead.assigned_to else None,
        test_drive_at=messaging.format_slot(drive.starts_at) if drive else None,
        trade_in=lead.details.get("trade_in"),
    )


async def apply_ai(
    session: AsyncSession, lead: Lead, actor_id: int | None = None, *, use_llm: bool = True
) -> None:
    result = await ai.analyse(await build_context(session, lead), use_llm=use_llm)
    lead.ai_summary = result.summary_payload()
    lead.ai_draft = result.draft
    add_event(session, lead, EventKind.AI, actor_id, source=result.source, flags=result.flags)


async def summarise_lead(lead_id: int) -> None:
    """Background task: runs after the request has returned, in its own session."""
    try:
        async with SessionLocal() as session:
            lead = await session.get(Lead, lead_id)
            if lead:
                await apply_ai(session, lead)
                await session.commit()
    except Exception:  # never let a background failure surface as a 500 elsewhere
        log.exception("AI summary failed for lead %s", lead_id)
