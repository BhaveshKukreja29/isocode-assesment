"""Auto-assignment: route each lead to a named consultant the moment it arrives.

Preference order (first non-empty pool wins):
  1. consultants at the lead's showroom who sell the lead's model
  2. anyone at that showroom
  3. anyone (any showroom) who sells the model
  4. anyone
Within a pool, the consultant with the fewest open leads wins; ties go to whoever
was assigned least recently, so work spreads evenly.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lead, User, consultant_models
from app.models.enums import LeadStatus, Role

OPEN_STATUSES = (
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.TEST_DRIVE,
    LeadStatus.NEGOTIATION,
)
_NEVER = datetime.min.replace(tzinfo=UTC)
_ASSIGNMENT_LOCK = 4_242  # pg advisory lock key; serialises concurrent assignments


@dataclass(frozen=True, slots=True)
class Candidate:
    id: int
    showroom_id: int | None
    model_ids: frozenset[int]
    open_leads: int
    last_assigned_at: datetime | None


def pick_consultant(
    candidates: list[Candidate], showroom_id: int | None, model_id: int | None
) -> Candidate | None:
    def sells(c: Candidate) -> bool:
        return model_id is None or not c.model_ids or model_id in c.model_ids

    local = [c for c in candidates if showroom_id is not None and c.showroom_id == showroom_id]
    pools = (
        [c for c in local if sells(c)],
        local,
        [c for c in candidates if sells(c)],
        candidates,
    )
    pool = next((p for p in pools if p), None)
    if pool is None:
        return None
    return min(pool, key=lambda c: (c.open_leads, c.last_assigned_at or _NEVER, c.id))


async def load_candidates(session: AsyncSession) -> list[Candidate]:
    load = (
        select(
            Lead.assigned_to_id.label("user_id"),
            func.count().filter(Lead.status.in_(OPEN_STATUSES)).label("open_leads"),
            func.max(Lead.assigned_at).label("last_assigned_at"),
        )
        .where(Lead.assigned_to_id.is_not(None))
        .group_by(Lead.assigned_to_id)
        .subquery()
    )
    skills = (
        select(
            consultant_models.c.user_id,
            func.array_agg(consultant_models.c.model_id).label("model_ids"),
        )
        .group_by(consultant_models.c.user_id)
        .subquery()
    )
    rows = await session.execute(
        select(
            User.id,
            User.showroom_id,
            skills.c.model_ids,
            func.coalesce(load.c.open_leads, 0),
            load.c.last_assigned_at,
        )
        .outerjoin(load, load.c.user_id == User.id)
        .outerjoin(skills, skills.c.user_id == User.id)
        .where(User.role == Role.CONSULTANT, User.is_active)
    )
    return [
        Candidate(uid, showroom_id, frozenset(model_ids or ()), open_leads, last)
        for uid, showroom_id, model_ids, open_leads, last in rows
    ]


async def auto_assign(session: AsyncSession, lead: Lead) -> int | None:
    """Assign within the caller's transaction. Returns the consultant id, if any."""
    await session.execute(select(func.pg_advisory_xact_lock(_ASSIGNMENT_LOCK)))
    chosen = pick_consultant(await load_candidates(session), lead.showroom_id, lead.model_id)
    if chosen:
        lead.assigned_to_id = chosen.id
        lead.assigned_at = datetime.now(UTC)
    return chosen.id if chosen else None
