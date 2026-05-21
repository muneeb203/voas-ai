from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    res = client.get("/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["environment"] in {"development", "staging", "production"}
    assert body["data"]["version"]


def test_unknown_route_returns_envelope(client: TestClient) -> None:
    res = client.get("/v1/does-not-exist")
    assert res.status_code == 404
    body = res.json()
    assert body["error"]["code"] == "NOT_FOUND"
