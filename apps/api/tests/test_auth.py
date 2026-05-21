from fastapi.testclient import TestClient


def test_protected_endpoint_requires_bearer(client: TestClient) -> None:
    res = client.get("/v1/me")
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoint_rejects_invalid_token(client: TestClient) -> None:
    res = client.get("/v1/me", headers={"Authorization": "Bearer invalid-token"})
    assert res.status_code == 401
    body = res.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoint_rejects_malformed_header(client: TestClient) -> None:
    res = client.get("/v1/me", headers={"Authorization": "NotBearer abc"})
    assert res.status_code == 401
