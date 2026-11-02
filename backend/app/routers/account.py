"""Buyer self-service, including DPDP Act rights: see your data, opt out, erase."""

import secrets

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, Session
from app.models import Lead, LeadEvent, TestDrive
from app.models.enums import BookingStatus
from app.schemas.auth import UserOut
from app.schemas.leads import ActivityItem
from app.security import SESSION_COOKIE

router = APIRouter(prefix="/me", tags=["account"])


class Preferences(BaseModel):
    marketing_opt_out: bool


@router.get("/activity", response_model=list[ActivityItem])
async def my_activity(user: CurrentUser, session: Session):
    leads = await session.scalars(
        select(Lead)
        .where(Lead.buyer_id == user.id)
        .options(selectinload(Lead.test_drives))
        .order_by(Lead.created_at.desc())
        .limit(50)
    )
    items = []
    for lead in leads:
        drive = next((d for d in lead.test_drives if d.status == BookingStatus.BOOKED), None)
        subject = lead.model.name if lead.model else None
        if lead.used_car:
            subject = f"{lead.used_car.year} {lead.used_car.make} {lead.used_car.model}"
        items.append(
            ActivityItem(
                lead_id=lead.id,
                kind=lead.kind,
                status=lead.status,
                subject=subject,
                created_at=lead.created_at,
                test_drive_at=drive.starts_at if drive else None,
                showroom=lead.showroom.name if lead.showroom else None,
            )
        )
    return items


@router.put("/preferences", response_model=UserOut)
async def set_preferences(body: Preferences, user: CurrentUser, session: Session):
    user.marketing_opt_out = body.marketing_opt_out
    await session.execute(
        update(Lead).where(Lead.buyer_id == user.id).values(opted_out=body.marketing_opt_out)
    )
    await session.commit()
    return user


@router.delete("", status_code=204)
async def erase_account(user: CurrentUser, session: Session, response: Response):
    """Right to erasure: anonymise the account and every lead it created."""
    my_leads = select(Lead.id).where(Lead.buyer_id == user.id)
    await session.execute(update(LeadEvent).where(LeadEvent.lead_id.in_(my_leads)).values(data={}))
    await session.execute(
        update(TestDrive)
        .where(TestDrive.lead_id.in_(my_leads))
        .where(TestDrive.status == BookingStatus.BOOKED)
        .values(status=BookingStatus.CANCELLED)
    )
    await session.execute(
        update(Lead)
        .where(Lead.buyer_id == user.id)
        .values(
            name="Erased buyer",
            phone="0000000000",
            email=None,
            message="",
            details={},
            ai_summary=None,
            ai_draft=None,
            opted_out=True,
            buyer_id=None,
        )
    )
    user.name = "Erased buyer"
    user.email = f"erased-{secrets.token_hex(8)}@invalid"
    user.phone = None
    user.is_active = False
    await session.commit()
    response.delete_cookie(SESSION_COOKIE)
