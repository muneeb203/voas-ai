from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from tests.helpers import TEST_USER_ID, auth_header


def _result(rows: list[dict] | dict | None) -> MagicMock:
    res = MagicMock()
    res.data = [rows] if isinstance(rows, dict) else (rows or [])
    return res


def test_bootstrap_workspace_creates_workspace_and_owner(client: TestClient) -> None:
    """POST /v1/workspaces creates workspace + owner membership + first location."""
    workspace_row = {
        "id": "ws-1",
        "name": "Pino's Pizza",
        "slug": "pinos-pizza",
        "plan": "professional",
        "vertical": "restaurant",
        "status": "active",
        "created_at": "2026-05-20T12:00:00+00:00",
        "updated_at": "2026-05-20T12:00:00+00:00",
    }

    with patch("app.services.workspace_service.get_supabase_admin") as get_db, patch(
        "app.services.audit_service.get_supabase_admin"
    ) as audit_db:
        db = MagicMock()
        get_db.return_value = db
        audit_db.return_value = MagicMock()

        # No existing membership.
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = _result([])
        # Slug uniqueness check returns empty.
        # Insert calls — set up via .insert(...).execute()
        db.table.return_value.insert.return_value.execute.return_value = _result(workspace_row)

        res = client.post(
            "/v1/workspaces",
            headers=auth_header(),
            json={
                "name": "Pino's Pizza",
                "vertical": "restaurant",
                "location_name": "Downtown",
                "location_address": "123 Main St",
                "location_phone": "+1-555-0100",
            },
        )

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["data"]["slug"] == "pinos-pizza"
    assert body["data"]["vertical"] == "restaurant"


def test_bootstrap_workspace_rejects_if_user_already_has_one(client: TestClient) -> None:
    with patch("app.services.workspace_service.get_supabase_admin") as get_db:
        db = MagicMock()
        get_db.return_value = db
        # User already has a membership.
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = _result(
            [{"workspace_id": "existing"}]
        )

        res = client.post(
            "/v1/workspaces",
            headers=auth_header(),
            json={"name": "Second", "location_name": "Branch"},
        )

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "CONFLICT"


def test_bootstrap_validates_required_fields(client: TestClient) -> None:
    res = client.post("/v1/workspaces", headers=auth_header(), json={"name": "X"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_workspace_context_404s_for_unknown_workspace(client: TestClient) -> None:
    with patch("app.deps.get_supabase_admin") as get_db:
        db = MagicMock()
        get_db.return_value = db
        # workspaces lookup returns nothing
        db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = _result([])

        res = client.get(
            "/v1/workspaces/00000000-0000-0000-0000-000000000000",
            headers=auth_header(),
        )

    assert res.status_code == 404


def test_workspace_context_403s_for_non_member(client: TestClient) -> None:
    with patch("app.deps.get_supabase_admin") as get_db:
        db = MagicMock()
        get_db.return_value = db

        # workspaces lookup returns active workspace; members lookup returns nothing.
        call_count = {"i": 0}

        def select_chain(*_args, **_kwargs):
            call_count["i"] += 1
            chain = MagicMock()
            if call_count["i"] == 1:
                chain.eq.return_value.limit.return_value.execute.return_value = _result(
                    {"id": "ws", "status": "active"}
                )
            else:
                chain.eq.return_value.eq.return_value.limit.return_value.execute.return_value = _result([])
            return chain

        db.table.return_value.select.side_effect = select_chain

        res = client.get(
            "/v1/workspaces/ws",
            headers=auth_header(user_id=TEST_USER_ID),
        )

    assert res.status_code == 403


def test_get_me_works_for_authed_user(client: TestClient) -> None:
    with patch("app.services.workspace_service.get_supabase_admin") as get_db:
        db = MagicMock()
        get_db.return_value = db

        # auth user metadata
        auth_res = MagicMock()
        auth_res.user.user_metadata = {"full_name": "Test User"}
        db.auth.admin.get_user_by_id.return_value = auth_res

        # memberships query
        db.table.return_value.select.return_value.eq.return_value.execute.return_value = _result([])

        res = client.get("/v1/me", headers=auth_header())

    assert res.status_code == 200
    body = res.json()
    assert body["data"]["id"] == TEST_USER_ID
    assert body["data"]["full_name"] == "Test User"
    assert body["data"]["memberships"] == []
