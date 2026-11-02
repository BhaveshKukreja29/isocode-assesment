from datetime import date, datetime, time

from app.config import IST
from app.services.slots import day_slots, free_slots

DAY = date(2026, 11, 10)


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, 10, hour, minute, tzinfo=IST)


def test_slots_fill_opening_hours_without_overrunning_close():
    slots = day_slots(DAY, time(10), time(13, 30), slot_minutes=60, not_before=at(0))
    assert slots == [at(10), at(11), at(12)]


def test_slots_before_lead_time_are_hidden():
    slots = day_slots(DAY, time(10), time(14), slot_minutes=60, not_before=at(11, 30))
    assert slots == [at(12), at(13)]


def test_booked_slots_are_removed():
    slots = [at(10), at(11), at(12)]
    assert free_slots(slots, [at(11)]) == [at(10), at(12)]


def test_booked_slot_matches_across_timezones():
    from datetime import UTC

    slots = [at(10), at(11)]
    assert free_slots(slots, [at(10).astimezone(UTC)]) == [at(11)]
