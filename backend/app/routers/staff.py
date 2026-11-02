from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, status
from sqlalchemy import ColumnElement, and_, extract, func, or_, select, true
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import contains
from app.deps import Session, StaffUser, not_found
from app.models import CarModel, Lead, LeadEvent, User
from app.models.enums import EventKind, LeadKind, LeadSource, LeadStatus, Role
from app.schemas.common import Page
from app.schemas.leads import (
    AssignIn,
    ContactIn,
    EventOut,
    ImportResult,
    InboxStats,
    LeadDetail,
    LeadFilters,
    LeadRow,
    Ref,
    StatusIn,
    TestDriveOut,
)
from app.services import messaging
from app.services.ai import DISCOUNT_RE
from app.services.assignment import OPEN_STATUSES
from app.services.csv_import import parse_csv
from app.services.leads import add_event, apply_ai, create_lead, summarise_lead

router = APIRouter(prefix="/staff", tags=["staff"])

MAX_UPLOAD_BYTES = 1_000_000
DUPLICATE_WINDOW = timedelta(days=30)
_CLOSED = (LeadStatus.WON, LeadStatus.LOST)


def visible_to(user: User) -> ColumnElement[bool]:
    """Consultants see their own leads, their showroom's leads and the unassigned queue."""
    if user.role == Role.ADMIN:
        return true()
    return or_(
        Lead.assigned_to_id == user.id,
        Lead.assigned_to_id.is_(None),
        and_(Lead.showroom_id.is_not(None), Lead.showroom_id == user.showroom_id),
    )


def scope_filter(user: User, scope: str) -> ColumnElement[bool]:
    match scope:
        case "mine":
            return Lead.assigned_to_id == user.id
        case "showroom":
            return Lead.showroom_id == user.showroom_id
        case "unassigned":
            return Lead.assigned_to_id.is_(None)
        case _:
            return true()


async def get_visible_lead(session: Session, user: User, lead_id: int) -> Lead:
    lead = await session.scalar(select(Lead).where(Lead.id == lead_id, visible_to(user)))
    if lead is None:
        raise not_found("Lead not found")
    return lead


@router.get("/leads", response_model=Page[LeadRow])
async def list_leads(user: StaffUser, session: Session, f: Annotated[LeadFilters, Query()]):
    stmt = select(Lead).where(visible_to(user), scope_filter(user, f.scope))
    if f.status:
        stmt = stmt.where(Lead.status.in_(f.status))
    if f.kind:
        stmt = stmt.where(Lead.kind == f.kind)
    if f.source:
        stmt = stmt.where(Lead.source == f.source)
    if f.q:
        term = contains(f.q)
        stmt = stmt.where(or_(Lead.name.ilike(term), Lead.phone.ilike(term)))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    # Leads still waiting for a first response float to the top, newest first.
    leads = await session.scalars(
        stmt.order_by(Lead.first_response_at.is_not(None), Lead.created_at.desc(), Lead.id.desc())
        .offset((f.page - 1) * f.page_size)
        .limit(f.page_size)
    )
    return Page(
        items=[LeadRow.model_validate(lead) for lead in leads],
        total=total or 0,
        page=f.page,
        page_size=f.page_size,
    )


@router.get("/leads/stats", response_model=InboxStats)
async def inbox_stats(user: StaffUser, session: Session):
    sla = timedelta(minutes=get_settings().lead_sla_minutes)
    now = datetime.now(UTC)
    response_secs = extract("epoch", Lead.first_response_at - Lead.created_at)
    awaiting = and_(Lead.first_response_at.is_(None), Lead.status.not_in(_CLOSED))
    recent = Lead.created_at >= now - timedelta(days=30)
    answered = Lead.first_response_at.is_not(None)
    row = (
        await session.execute(
            select(
                func.count().filter(Lead.status.in_(OPEN_STATUSES)),
                func.count().filter(awaiting),
                func.count().filter(awaiting, Lead.created_at < now - sla),
                func.count().filter(recent, answered, response_secs <= sla.total_seconds()),
                func.count().filter(recent, or_(answered, Lead.created_at < now - sla)),
                func.percentile_cont(0.5).within_group(response_secs).filter(recent, answered),
            ).where(
                visible_to(user),
                Lead.assigned_to_id == user.id if user.role == Role.CONSULTANT else true(),
            )
        )
    ).one()
    open_, waiting, overdue, in_sla, measurable, median = row
    return InboxStats(
        open=open_,
        awaiting_reply=waiting,
        overdue=overdue,
        answered_in_sla_pct=round(100 * in_sla / measurable, 1) if measurable else None,
        median_response_minutes=round(median / 60, 1) if median is not None else None,
        sla_minutes=get_settings().lead_sla_minutes,
    )


@router.get("/leads/{lead_id}", response_model=LeadDetail)
async def get_lead(lead_id: int, user: StaffUser, session: Session):
    lead = await session.scalar(
        select(Lead)
        .where(Lead.id == lead_id, visible_to(user))
        .options(
            selectinload(Lead.events).joinedload(LeadEvent.actor),
            selectinload(Lead.test_drives),
        )
        .execution_options(populate_existing=True)
    )
    if lead is None:
        raise not_found("Lead not found")
    return lead_detail(lead)


def lead_detail(lead: Lead) -> LeadDetail:
    row = LeadRow.model_validate(lead).model_dump()
    return LeadDetail(
        **row,
        email=lead.email,
        message=lead.message,
        details=lead.details,
        used_car_slug=lead.used_car.slug if lead.used_car else None,
        opted_out=lead.opted_out,
        ai_summary=lead.ai_summary,
        ai_draft=lead.ai_draft,
        events=[EventOut.model_validate(e) for e in lead.events],
        test_drives=[
            TestDriveOut(
                id=d.id,
                starts_at=d.starts_at,
                status=d.status,
                car=f"{lead.subject or ''} {d.demo_car.variant.name} · {d.demo_car.colour}".strip(),
                showroom=d.demo_car.showroom.name,
            )
            for d in lead.test_drives
        ],
    )


def mark_first_response(lead: Lead) -> None:
    if lead.first_response_at is None:
        lead.first_response_at = datetime.now(UTC)


@router.patch("/leads/{lead_id}/status", response_model=LeadDetail)
async def set_status(lead_id: int, body: StatusIn, user: StaffUser, session: Session):
    lead = await get_visible_lead(session, user, lead_id)
    if lead.status != body.status:
        add_event(
            session, lead, EventKind.STATUS, user.id, **{"from": lead.status, "to": body.status}
        )
        lead.status = body.status
        if body.status != LeadStatus.NEW:
            mark_first_response(lead)
        await session.commit()
    return await get_lead(lead_id, user, session)


@router.post("/leads/{lead_id}/assign", response_model=LeadDetail)
async def reassign(lead_id: int, body: AssignIn, user: StaffUser, session: Session):
    lead = await get_visible_lead(session, user, lead_id)
    target = await session.get(User, body.user_id)
    if target is None or target.role != Role.CONSULTANT or not target.is_active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Pick an active consultant")
    if lead.assigned_to_id != target.id:
        add_event(
            session,
            lead,
            EventKind.REASSIGNED,
            user.id,
            **{"from": lead.assigned_to.name if lead.assigned_to else None, "to": target.name},
        )
        lead.assigned_to_id = target.id
        lead.assigned_at = datetime.now(UTC)
        await session.commit()
    return await get_lead(lead_id, user, session)


@router.post("/leads/{lead_id}/contact", response_model=LeadDetail)
async def contact(lead_id: int, body: ContactIn, user: StaffUser, session: Session):
    lead = await get_visible_lead(session, user, lead_id)
    if body.channel == "call":
        add_event(session, lead, EventKind.MESSAGE, user.id, channel="call", body=body.body)
    else:
        if DISCOUNT_RE.search(body.body):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Messages can't mention discounts or offers. Discuss pricing in person.",
            )
        if not messaging.send(session, lead, body.body, user.id, body.channel):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This buyer opted out of messages. Call them instead."
            )
    mark_first_response(lead)
    if lead.status == LeadStatus.NEW:
        add_event(session, lead, EventKind.STATUS, user.id, **{"from": "new", "to": "contacted"})
        lead.status = LeadStatus.CONTACTED
    await session.commit()
    return await get_lead(lead_id, user, session)


@router.post("/leads/{lead_id}/ai", response_model=LeadDetail)
async def regenerate_ai(lead_id: int, user: StaffUser, session: Session):
    lead = await get_visible_lead(session, user, lead_id)
    await apply_ai(session, lead, user.id)
    await session.commit()
    return await get_lead(lead_id, user, session)


@router.get("/consultants", response_model=list[Ref])
async def list_consultants(_: StaffUser, session: Session):
    return (
        await session.scalars(
            select(User)
            .where(User.role == Role.CONSULTANT, User.is_active)
            .order_by(User.showroom_id, User.name)
        )
    ).all()


async def summarise_many(lead_ids: list[int]) -> None:
    for lead_id in lead_ids:
        await summarise_lead(lead_id)


@router.post("/leads/import", response_model=ImportResult)
async def import_portal_csv(
    file: UploadFile, user: StaffUser, session: Session, tasks: BackgroundTasks
):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "CSV must be under 1 MB")
    rows, errors = parse_csv(content)

    models = {
        key.lower(): model_id
        for model_id, name, slug in await session.execute(
            select(CarModel.id, CarModel.name, CarModel.slug)
        )
        for key in (name, slug)
    }
    since = datetime.now(UTC) - DUPLICATE_WINDOW
    recent = await session.execute(
        select(Lead.phone, Lead.model_id, Lead.external_ref).where(Lead.created_at >= since)
    )
    seen_contacts, seen_refs = set(), set()
    for phone, model_id, ref in recent:
        seen_contacts.add((phone, model_id))
        seen_refs.add(ref)

    created_ids, duplicates = [], 0
    for _, row in rows:
        model_id = models.get((row.model or "").lower())
        if (row.phone, model_id) in seen_contacts or (row.ref and row.ref in seen_refs):
            duplicates += 1
            continue
        seen_contacts.add((row.phone, model_id))
        seen_refs.add(row.ref)
        lead = Lead(
            name=row.name,
            phone=row.phone,
            email=row.email,
            kind=LeadKind.ENQUIRY,
            source=LeadSource.PORTAL,
            message=row.message,
            details={"portal": row.portal, **({"model_text": row.model} if row.model else {})},
            external_ref=row.ref,
            model_id=model_id,
            consent_at=datetime.now(UTC),
        )
        if received := row.received():
            lead.created_at = received
        await create_lead(session, lead)
        created_ids.append(lead.id)

    await session.commit()
    tasks.add_task(summarise_many, created_ids)
    return ImportResult(created=len(created_ids), duplicates=duplicates, errors=errors)
