from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


def _fake_insert_response(payload: dict[str, str | None]) -> MagicMock:
    inserted = {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": payload["name"],
        "email": payload["email"],
        "company": payload.get("company"),
        "phone": payload.get("phone"),
        "message": payload["message"],
        "source": payload.get("source"),
        "status": "new",
        "created_at": "2026-05-20T12:00:00+00:00",
    }
    res = MagicMock()
    res.data = [inserted]
    return res


def test_contact_creates_submission(client: TestClient) -> None:
    payload = {
        "name": "Test Inbound",
        "email": "test@example.com",
        "company": "Test Co.",
        "phone": "+1-555-0100",
        "message": "Interested in a pilot for a 12-location chain.",
        "source": "/contact",
    }

    with patch("app.services.contact_service.get_supabase_admin") as get_db:
        chain = get_db.return_value.table.return_value.insert.return_value
        chain.execute.return_value = _fake_insert_response(payload)

        res = client.post("/v1/contact", json=payload)

    assert res.status_code == 201
    body = res.json()
    assert body["data"]["email"] == "test@example.com"
    assert body["data"]["status"] == "new"


def test_contact_validates_required_fields(client: TestClient) -> None:
    res = client.post("/v1/contact", json={"name": "Missing email"})
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_contact_validates_email(client: TestClient) -> None:
    res = client.post(
        "/v1/contact",
        json={"name": "Test", "email": "not-an-email", "message": "hi"},
    )
    assert res.status_code == 422
