from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.config import IST, get_settings
from app.deps import OptionalUser, Session, not_found
from app.models import CarModel, DemoCar, Lead, Showroom, TestDrive, UsedCar
from app.models.enums import BookingStatus, LeadKind, LeadSource, LeadStatus, Role, StockStatus
from app.schemas.leads import EnquiryIn, LeadCreated, Slot, TestDriveIn
from app.services import messaging
from app.services.leads import create_lead, summarise_lead
from app.services.slots import day_slots

router = APIRouter(tags=["enquiries"])

MAX_UPCOMING_DRIVES_PER_PHONE = 2


def unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, message)


@router.post("/leads", status_code=201, response_model=LeadCreated)
async def create_enquiry(
    body: EnquiryIn, session: Session, tasks: BackgroundTasks, user: OptionalUser
):
    model_id = used_car_id = None
    showroom_id = body.showroom_id
    if body.model_slug:
        model_id = await session.scalar(
            select(CarModel.id).where(CarModel.slug == body.model_slug, CarModel.is_published)
        )
        if model_id is None:
            raise not_found("Model not found")
    if body.used_car_slug:
        car = await session.scalar(
            select(UsedCar).where(
                UsedCar.slug == body.used_car_slug, UsedCar.status != StockStatus.SOLD
            )
        )
        if car is None:
            raise not_found("This car is no longer listed")
        used_car_id, showroom_id = car.id, car.showroom_id
    if body.kind == LeadKind.USED_CAR and used_car_id is None:
        raise unprocessable("Pick a used car to enquire about")
    if body.kind == LeadKind.TRADE_IN and body.trade_in is None:
        raise unprocessable("Tell us about the car you want to trade in")
    if showroom_id is not None and await session.get(Showroom, showroom_id) is None:
        raise not_found("Showroom not found")

    lead = Lead(
        name=body.name,
        phone=body.phone,
        email=body.email,
        kind=body.kind,
        source=LeadSource.WEBSITE,
        message=body.message,
        details={"trade_in": body.trade_in.model_dump()} if body.trade_in else {},
        model_id=model_id,
        used_car_id=used_car_id,
        showroom_id=showroom_id,
        buyer_id=user.id if user and user.role == Role.BUYER else None,
        consent_at=datetime.now(UTC),
        opted_out=bool(user and user.marketing_opt_out),
    )
    consultant = await create_lead(session, lead)
    await session.commit()
    tasks.add_task(summarise_lead, lead.id)
    return LeadCreated(id=lead.id, consultant=consultant.name if consultant else None)


async def active_demo_car(session: Session, demo_car_id: int) -> DemoCar:
    demo = await session.get(DemoCar, demo_car_id)
    if demo is None or not demo.is_active:
        raise not_found("Demo car not found")
    return demo


def bookable_slots(demo: DemoCar, day: date) -> list[datetime]:
    settings = get_settings()
    today = datetime.now(IST).date()
    if not today <= day <= today + timedelta(days=settings.booking_window_days):
        raise unprocessable(f"Pick a date within the next {settings.booking_window_days} days")
    return day_slots(
        day,
        demo.showroom.opens_at,
        demo.showroom.closes_at,
        slot_minutes=settings.slot_minutes,
        not_before=datetime.now(IST) + timedelta(minutes=settings.booking_lead_time_minutes),
    )


@router.get("/test-drives/slots", response_model=list[Slot])
async def list_slots(session: Session, demo_car_id: int, day: date):
    demo = await active_demo_car(session, demo_car_id)
    slots = bookable_slots(demo, day)
    day_start = datetime.combine(day, time.min, IST)
    taken = set(
        await session.scalars(
            select(TestDrive.starts_at).where(
                TestDrive.demo_car_id == demo.id,
                TestDrive.status == BookingStatus.BOOKED,
                TestDrive.starts_at >= day_start,
                TestDrive.starts_at < day_start + timedelta(days=1),
            )
        )
    )
    return [Slot(starts_at=s, available=s not in taken) for s in slots]


@router.post("/test-drives", status_code=201, response_model=LeadCreated)
async def book_test_drive(
    body: TestDriveIn, session: Session, tasks: BackgroundTasks, user: OptionalUser
):
    demo = await active_demo_car(session, body.demo_car_id)
    starts_at = body.starts_at.astimezone(IST)
    if starts_at not in bookable_slots(demo, starts_at.date()):
        raise unprocessable("That slot isn't available. Please pick another time.")

    upcoming = await session.scalar(
        select(func.count())
        .select_from(TestDrive)
        .join(Lead)
        .where(
            Lead.phone == body.phone,
            TestDrive.status == BookingStatus.BOOKED,
            TestDrive.starts_at > func.now(),
        )
    )
    if upcoming >= MAX_UPCOMING_DRIVES_PER_PHONE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You already have upcoming test drives booked. Your consultant can help with more.",
        )

    lead = Lead(
        name=body.name,
        phone=body.phone,
        email=body.email,
        kind=LeadKind.TEST_DRIVE,
        status=LeadStatus.TEST_DRIVE,
        source=LeadSource.WEBSITE,
        message=body.message,
        model_id=demo.variant.model_id,
        showroom_id=demo.showroom_id,
        buyer_id=user.id if user and user.role == Role.BUYER else None,
        consent_at=datetime.now(UTC),
        opted_out=bool(user and user.marketing_opt_out),
    )
    consultant = await create_lead(session, lead, acknowledge=False)
    session.add(TestDrive(lead_id=lead.id, demo_car_id=demo.id, starts_at=starts_at))
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Someone just booked that slot. Please pick another."
        ) from exc

    confirmation = messaging.test_drive_confirmation(lead, starts_at, demo.showroom.name)
    if consultant:
        confirmation += f" {consultant.name} will be your consultant."
    messaging.send(session, lead, confirmation)
    await session.commit()
    tasks.add_task(summarise_lead, lead.id)
    return LeadCreated(
        id=lead.id,
        consultant=consultant.name if consultant else None,
        test_drive_at=starts_at,
    )
