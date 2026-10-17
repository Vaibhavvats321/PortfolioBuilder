"""Tests for the health endpoint."""

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["service"], str) and body["service"]
    assert isinstance(body["environment"], str) and body["environment"]
    assert set(body) == {"status", "service", "environment"}


def test_health_does_not_expose_internals(client: TestClient) -> None:
    body = client.get("/health").json()

    serialized = str(body).lower()
    for forbidden in ("password", "postgresql", "database_url", "traceback"):
        assert forbidden not in serialized
