"""End-to-end API tests on the seeded demo database."""

from datetime import date, datetime, timedelta

import pytest

from app.config import IST


async def variant_id(client, model: str, name: str) -> int:
    detail = (await client.get(f"/models/{model}")).json()
    return next(v["id"] for v in detail["variants"] if v["name"] == name)


def tomorrow_at(hour: int) -> str:
    day = datetime.now(IST).date() + timedelta(days=1)
    return datetime.combine(day, datetime.min.time(), IST).replace(hour=hour).isoformat()


# ---------------------------------------------------------------- catalogue & pricing


async def test_sample_car_on_road_price_breakup(client):
    vid = await variant_id(client, "model-h", "ZX automatic")
    body = (await client.get(f"/models/model-h/price?variant_id={vid}&city=lucknow")).json()
    items = {i["key"]: i["amount"] for i in body["items"]}
    assert items["ex_showroom"] == 12_45_000
    assert items["road_tax"] == 1_24_500  # 10% UP slab above ₹10 lakh
    assert items["tcs"] == 12_450
    assert body["total"] == sum(items.values())
    assert date.fromisoformat(body["valid_until"]) > date.today()


async def test_city_changes_tax_regime(client):
    vid = await variant_id(client, "model-c", "VX")  # diesel
    lucknow = (await client.get(f"/models/model-c/price?variant_id={vid}&city=lucknow")).json()
    delhi = (await client.get(f"/models/model-c/price?variant_id={vid}&city=new-delhi")).json()
    rate = {
        b["city"]["slug"]: next(i for i in b["items"] if i["key"] == "road_tax")["rate"]
        for b in (lucknow, delhi)
    }
    assert rate == {"lucknow": "10.00", "new-delhi": "12.50"}


async def test_variant_from_another_model_is_rejected(client):
    vid = await variant_id(client, "model-s", "LX")
    assert (await client.get(f"/models/model-h/price?variant_id={vid}")).status_code == 404


# ---------------------------------------------------------------- used cars


async def test_used_car_filters_and_pagination(client):
    page = (await client.get("/used-cars?fuel=diesel&max_price=900000&page_size=5")).json()
    assert page["total"] >= 1 and len(page["items"]) <= 5
    assert all(c["fuel"] == "diesel" and c["price"] <= 900_000 for c in page["items"])
    assert all(c["status"] != "sold" for c in page["items"])


async def test_used_car_registration_is_masked(client):
    page = (await client.get("/used-cars?q=UC-1182")).json()
    detail = (await client.get(f"/used-cars/{page['items'][0]['slug']}")).json()
    assert detail["km"] == 41_200 and detail["price"] == 8_45_000
    assert "••" in detail["registration"] and "registration_no" not in detail


async def test_search_escapes_like_wildcards(client):
    assert (await client.get("/used-cars?q=%25")).json()["total"] == 0


# ---------------------------------------------------------------- enquiries & bookings


async def test_enquiry_is_assigned_and_acknowledged(client, login):
    response = await client.post(
        "/leads",
        json={
            "name": "Asha Rao",
            "phone": "+91 98390 55555",
            "model_slug": "model-e",
            "showroom_id": 1,
            "message": "EV under 18 lakh",
            "consent": True,
        },
    )
    assert response.status_code == 201
    lead = response.json()
    assert lead["consultant"] in {"Aman Verma", "Priya Singh"}  # Gomti Nagar, sells Model E

    await login("admin@demo.in")
    detail = (await client.get(f"/staff/leads/{lead['id']}")).json()
    assert detail["phone"] == "9839055555"
    kinds = [e["kind"] for e in detail["events"]]
    assert kinds[:3] == ["created", "assigned", "message"]


async def test_enquiry_requires_consent(client):
    response = await client.post(
        "/leads", json={"name": "Asha Rao", "phone": "9839055555", "consent": False}
    )
    assert response.status_code == 422


async def test_slot_cannot_be_double_booked(client):
    body = {
        "name": "Kiran Das",
        "phone": "9839066666",
        "demo_car_id": 2,
        "starts_at": tomorrow_at(16),
        "consent": True,
    }
    assert (await client.post("/test-drives", json=body)).status_code == 201
    again = await client.post("/test-drives", json={**body, "phone": "9839077777"})
    assert again.status_code == 409
    slots = await client.get(f"/test-drives/slots?demo_car_id=2&day={body['starts_at'][:10]}")
    taken = [s for s in slots.json() if not s["available"]]
    assert any(s["starts_at"].startswith(body["starts_at"][:16]) for s in taken)


async def test_off_grid_or_closed_hours_slot_rejected(client):
    for hour in (9, 19):
        body = {
            "name": "Kiran Das",
            "phone": "9839088888",
            "demo_car_id": 2,
            "starts_at": tomorrow_at(hour),
            "consent": True,
        }
        assert (await client.post("/test-drives", json=body)).status_code == 422


# ---------------------------------------------------------------- access control


@pytest.mark.parametrize(
    ("email", "path", "status"),
    [
        (None, "/staff/leads", 401),
        ("buyer@demo.in", "/staff/leads", 403),
        ("aman@demo.in", "/admin/models", 403),
        ("admin@demo.in", "/admin/models", 200),
    ],
)
async def test_role_access(client, login, email, path, status):
    if email:
        await login(email)
    assert (await client.get(path)).status_code == status


async def test_consultant_cannot_open_other_showrooms_leads(client, login):
    await login("admin@demo.in")
    leads = (await client.get("/staff/leads?scope=all&page_size=100")).json()["items"]
    other = next(
        lead
        for lead in leads
        if lead["showroom"] and lead["showroom"]["id"] == 3 and lead["assigned_to"]
    )
    await client.post("/auth/logout")
    await login("aman@demo.in")  # Gomti Nagar (showroom 1)
    assert (await client.get(f"/staff/leads/{other['id']}")).status_code == 404


# ---------------------------------------------------------------- inbox actions


async def test_reply_guardrail_and_first_response(client, login):
    await login("aman@demo.in")
    lead = (await client.get("/staff/leads?scope=mine&status=new")).json()["items"][0]
    blocked = await client.post(
        f"/staff/leads/{lead['id']}/contact",
        json={"channel": "whatsapp", "body": "Special Diwali discount just for you!"},
    )
    assert blocked.status_code == 422

    sent = await client.post(
        f"/staff/leads/{lead['id']}/contact",
        json={"channel": "whatsapp", "body": "Hi, Aman here. When can I call you?"},
    )
    assert sent.status_code == 200
    assert sent.json()["status"] == "contacted"
    assert sent.json()["first_response_at"] is not None


async def test_reassign_to_consultant_only(client, login):
    await login("aman@demo.in")
    lead = (await client.get("/staff/leads?scope=mine")).json()["items"][0]
    to_admin = await client.post(f"/staff/leads/{lead['id']}/assign", json={"user_id": 1})
    assert to_admin.status_code == 422
    moved = await client.post(f"/staff/leads/{lead['id']}/assign", json={"user_id": 3})
    assert moved.json()["assigned_to"]["name"] == "Priya Singh"
    assert moved.json()["events"][-1]["kind"] == "reassigned"


async def test_csv_import_dedupes_and_reports_bad_rows(client, login):
    await login("aman@demo.in")
    csv = (
        "name,phone,email,model,message,portal,ref\n"
        "Om Prakash,9876512345,,Model H,Diesel SUV please,CarPortal,CP-1\n"
        "Om Prakash,9876512345,,model-h,Duplicate row,CarPortal,CP-2\n"
        "Bad Phone,12345,,Model S,,CarPortal,CP-3\n"
        "Ritika Sharma,9876501234,,Model H,Already a lead,CarPortal,CP-4\n"
    )
    result = (
        await client.post("/staff/leads/import", files={"file": ("leads.csv", csv, "text/csv")})
    ).json()
    assert result["created"] == 1
    assert result["duplicates"] == 2
    assert [e["row"] for e in result["errors"]] == [4]


# ---------------------------------------------------------------- admin


async def test_admin_price_change_flows_to_on_road_price(client, login):
    await login("admin@demo.in")
    vid = await variant_id(client, "model-s", "LX")
    cell = {"variant_id": vid, "city_id": 1, "ex_showroom": 6_99_000, "valid_until": "2030-01-31"}
    assert (await client.put("/admin/prices", json={"cells": [cell]})).status_code == 204
    body = (await client.get(f"/models/model-s/price?variant_id={vid}&city=lucknow")).json()
    assert body["items"][0]["amount"] == 6_99_000
    assert body["valid_until"] == "2030-01-31"


async def test_admin_rejects_broken_tax_slabs(client, login):
    await login("admin@demo.in")
    city = (await client.get("/admin/cities")).json()[0]
    city["tax_slabs"] = [
        {"fuel": "petrol", "min_price": 0, "max_price": 500000, "rate": "8"},
        {"fuel": "petrol", "min_price": 600000, "max_price": None, "rate": "10"},
    ]
    response = await client.put(f"/admin/cities/{city['id']}", json=city)
    assert response.status_code == 422
    assert "gap" in response.json()["detail"]


# ---------------------------------------------------------------- buyer rights


async def test_buyer_opt_out_blocks_messages(client, login):
    await login("buyer@demo.in")
    assert (
        await client.put("/me/preferences", json={"marketing_opt_out": True})
    ).status_code == 200
    activity = (await client.get("/me/activity")).json()
    assert activity, "seeded buyer has at least one enquiry"
    await client.post("/auth/logout")

    await login("admin@demo.in")
    response = await client.post(
        f"/staff/leads/{activity[0]['lead_id']}/contact",
        json={"channel": "sms", "body": "Hello, following up on your enquiry."},
    )
    assert response.status_code == 409
