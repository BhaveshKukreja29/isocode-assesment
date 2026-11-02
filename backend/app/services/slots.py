"""Test-drive slots. A slot is a fixed-length window inside showroom hours for one demo car."""

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta

from app.config import IST


def day_slots(
    day: date,
    opens: time,
    closes: time,
    *,
    slot_minutes: int,
    not_before: datetime,
) -> list[datetime]:
    """All bookable slot start times on `day` (IST) that begin at or after `not_before`."""
    step = timedelta(minutes=slot_minutes)
    start = datetime.combine(day, opens, IST)
    last_start = datetime.combine(day, closes, IST) - step
    slots = []
    while start <= last_start:
        if start >= not_before:
            slots.append(start)
        start += step
    return slots


def free_slots(slots: list[datetime], booked: Iterable[datetime]) -> list[datetime]:
    taken = set(booked)
    return [s for s in slots if s not in taken]
