import json

import httpx
import pytest

from app.config import get_settings
from app.services import ai
from app.services.ai import LeadContext, analyse, guardrail_flags, rules_draft, rules_summary

CTX = LeadContext(
    name="Ritika Sharma",
    kind="enquiry",
    source="website",
    message="Looking for an automatic petrol SUV around 12 lakh, need a loan. "
    "Want to buy before Diwali, have an old car to exchange.",
    model="Model H",
    showroom="Gomti Nagar",
    consultant="Aman Verma",
)


def test_rules_summary_extracts_buyer_needs():
    s = rules_summary(CTX)
    assert s.budget == "About ₹12 lakh"
    assert s.timeline == "1–2 months"
    assert s.finance == "Wants finance / EMI options"
    assert s.trade_in == "Has a car to exchange"
    assert {"Automatic", "Petrol"} <= set(s.preferences)
    assert s.ask_next == []


def test_sparse_message_yields_questions_and_low_confidence():
    ctx = LeadContext(name="Raj", kind="enquiry", source="portal", message="call me")
    s = rules_summary(ctx)
    assert s.budget is None and s.interest is None
    assert len(s.ask_next) == 3
    assert ai.confidence_for(s) == "low"


@pytest.mark.parametrize(
    "text",
    [
        "We can give you a ₹20,000 discount",
        "Get 5% off this week",
        "Special Diwali offer for you",
        "Accessories for free if you book today",
        "Price is ₹12,45,000",
        "It comes to 14.2 lakh on-road",
    ],
)
def test_guardrails_catch_discounts_and_prices(text):
    assert guardrail_flags(text)


@pytest.mark.parametrize(
    "text",
    [
        "Feel free to call me anytime.",
        "I'm your dealer contact for the Model H.",
        "Your test drive is on Sat 08 Nov, 11:00 AM.",
    ],
)
def test_guardrails_allow_normal_replies(text):
    assert guardrail_flags(text) == []


def test_rules_draft_is_always_guardrail_clean():
    for kind in ("enquiry", "test_drive", "used_car", "trade_in"):
        ctx = LeadContext(
            name="A B",
            kind=kind,
            source="website",
            message="",
            model="Model S",
            test_drive_at="Sat 08 Nov, 11:00 AM",
        )
        assert guardrail_flags(rules_draft(ctx)) == []


async def test_without_api_key_falls_back_to_rules():
    result = await analyse(CTX)
    assert result.source == "rules"
    assert "llm_disabled" in result.flags
    assert result.draft.startswith("Hi Ritika")


@pytest.fixture
def groq(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    get_settings.cache_clear()
    yield monkeypatch
    get_settings.cache_clear()


def fake_llm(groq, draft: str | None = None, status: int = 200, raw: str | None = None):
    content = raw or json.dumps(
        {"summary": {"headline": "SUV buyer", "budget": "₹12 lakh"}, "draft": draft}
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"choices": [{"message": {"content": content}}]})

    real_client = httpx.AsyncClient
    groq.setattr(
        ai.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )


async def test_llm_draft_used_when_clean(groq):
    fake_llm(
        groq,
        draft="Hi Ritika, this is Aman. Happy to help you with the Model H. "
        "When is a good time to call?",
    )
    result = await analyse(CTX)
    assert result.source == "llm"
    assert result.flags == []
    assert result.summary["headline"] == "SUV buyer"


async def test_llm_draft_with_discount_is_replaced(groq):
    fake_llm(groq, draft="Hi Ritika! Great news, we have a festive discount on the Model H.")
    result = await analyse(CTX)
    assert result.source == "llm"
    assert result.flags == ["draft_replaced:mentions_discount"]
    assert result.draft == rules_draft(CTX)


async def test_llm_error_falls_back(groq):
    fake_llm(groq, status=503, draft="x" * 30)
    result = await analyse(CTX)
    assert (result.source, result.flags) == ("rules", ["llm_failed"])


async def test_llm_malformed_json_falls_back(groq):
    fake_llm(groq, raw='{"summary": "not an object"}')
    result = await analyse(CTX)
    assert (result.source, result.flags) == ("rules", ["llm_failed"])
