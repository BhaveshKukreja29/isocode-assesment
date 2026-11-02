from datetime import UTC, datetime

from app.services.assignment import Candidate, pick_consultant

T1 = datetime(2026, 11, 1, 10, tzinfo=UTC)
T2 = datetime(2026, 11, 2, 10, tzinfo=UTC)


def c(id, showroom, models=(), open_leads=0, last=None) -> Candidate:
    return Candidate(id, showroom, frozenset(models), open_leads, last)


def test_prefers_specialist_at_same_showroom():
    team = [c(1, 1, models={9}, open_leads=5), c(2, 1, models={7}), c(3, 2, models={7})]
    assert pick_consultant(team, showroom_id=1, model_id=7).id == 2


def test_generalist_counts_as_selling_every_model():
    team = [c(1, 1, models={9}), c(2, 1, open_leads=3)]
    assert pick_consultant(team, showroom_id=1, model_id=7).id == 2


def test_least_loaded_wins_then_least_recently_assigned():
    team = [c(1, 1, open_leads=4), c(2, 1, open_leads=2, last=T2), c(3, 1, open_leads=2, last=T1)]
    assert pick_consultant(team, showroom_id=1, model_id=None).id == 3


def test_never_assigned_beats_recently_assigned():
    team = [c(1, 1, open_leads=0, last=T1), c(2, 1, open_leads=0)]
    assert pick_consultant(team, showroom_id=1, model_id=None).id == 2


def test_falls_back_to_showroom_when_no_specialist_there():
    team = [c(1, 1, models={9}), c(2, 2, models={7})]
    assert pick_consultant(team, showroom_id=1, model_id=7).id == 1


def test_falls_back_to_any_showroom_specialist_when_showroom_unknown():
    team = [c(1, 1, models={9}), c(2, 2, models={7}, open_leads=9)]
    assert pick_consultant(team, showroom_id=None, model_id=7).id == 2


def test_no_consultants_means_unassigned():
    assert pick_consultant([], showroom_id=1, model_id=1) is None
