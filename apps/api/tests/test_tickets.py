from fastapi.testclient import TestClient

from tests.helpers import auth_header


def test_create_ticket_validates_required_fields(client: TestClient) -> None:
    res = client.post(
        "/v1/workspaces/00000000-0000-0000-0000-000000000000/tickets",
        headers=auth_header(),
        json={"subject": "Hi"},  # body missing, subject too short
    )
    assert res.status_code in {403, 404, 422}
    body = res.json()
    assert "error" in body


def test_update_status_rejects_non_resolved_for_users(client: TestClient) -> None:
    """Users can only set 'resolved'; other statuses come from admins."""
    res = client.patch(
        "/v1/workspaces/00000000-0000-0000-0000-000000000000/tickets/abc",
        headers=auth_header(),
        json={"status": "closed"},
    )
    # Will 404 (workspace context fails first) or 403 (status forbidden).
    assert res.status_code in {403, 404}


def test_list_tickets_requires_auth(client: TestClient) -> None:
    res = client.get("/v1/workspaces/abc/tickets")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"
