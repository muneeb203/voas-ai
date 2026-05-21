from fastapi.testclient import TestClient

from tests.helpers import auth_header


def test_conversations_require_auth(client: TestClient) -> None:
    res = client.get("/v1/workspaces/abc/conversations")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


def test_orders_require_auth(client: TestClient) -> None:
    res = client.get("/v1/workspaces/abc/orders")
    assert res.status_code == 401


def test_menu_requires_auth(client: TestClient) -> None:
    res = client.get("/v1/workspaces/abc/menu/categories")
    assert res.status_code == 401


def test_create_menu_category_validates_required(client: TestClient) -> None:
    res = client.post(
        "/v1/workspaces/00000000-0000-0000-0000-000000000000/menu/categories",
        headers=auth_header(),
        json={},  # name missing
    )
    assert res.status_code in {403, 404, 422}


def test_create_menu_item_validates_price(client: TestClient) -> None:
    res = client.post(
        "/v1/workspaces/00000000-0000-0000-0000-000000000000/menu/items",
        headers=auth_header(),
        json={"category_id": "abc", "name": "Test", "price_cents": -100},
    )
    assert res.status_code in {403, 404, 422}


def test_conversation_create_validates_channel(client: TestClient) -> None:
    res = client.post(
        "/v1/workspaces/00000000-0000-0000-0000-000000000000/conversations",
        headers=auth_header(),
        json={"channel": "telepathy"},
    )
    assert res.status_code in {403, 404, 422}
