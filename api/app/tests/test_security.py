"""Security-focused tests: cookies, CSRF, uniqueness, and isolation."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_token
from app.models.session import Session as AuthSession
from app.models.user import User
from app.tests.support import register, unique_email


def _set_cookie_header(response, name: str) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith(f"{name}="):
            return header
    raise AssertionError(f"No Set-Cookie header for {name}")


def test_session_cookie_is_httponly_and_samesite(
    client: TestClient, session_cookie_name: str
) -> None:
    _, response = register(client)

    header = _set_cookie_header(response, session_cookie_name)
    assert "HttpOnly" in header
    assert "SameSite=lax" in header.lower() or "samesite=lax" in header.lower()
    assert "Path=/" in header


def test_csrf_cookie_is_script_readable(client: TestClient, csrf_cookie_name: str) -> None:
    _, response = register(client)

    header = _set_cookie_header(response, csrf_cookie_name)
    assert "HttpOnly" not in header


def test_secure_flag_follows_environment(client: TestClient, session_cookie_name: str) -> None:
    _, response = register(client)

    header = _set_cookie_header(response, session_cookie_name)
    if get_settings().secure_cookies:
        assert "Secure" in header
    else:
        assert "Secure" not in header


def test_only_session_token_hash_is_persisted(
    client: TestClient, db_session: Session, session_cookie_name: str
) -> None:
    register(client)
    raw_token = client.cookies.get(session_cookie_name)
    assert raw_token

    session = db_session.scalar(select(AuthSession))
    assert session is not None
    assert session.token_hash != raw_token
    assert session.token_hash == hash_token(raw_token)


def test_logout_rejects_mismatched_csrf_token(client: TestClient) -> None:
    register(client)

    response = client.post("/auth/logout", headers={"X-CSRF-Token": "wrong-token"})

    assert response.status_code == 403


def test_database_enforces_unique_email(db_session: Session) -> None:
    email = unique_email()
    db_session.add(User(email=email, password_hash="x", display_name="A", is_active=True))
    db_session.commit()

    db_session.add(User(email=email, password_hash="y", display_name="B", is_active=True))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_duplicate_registration_leaves_single_user(client: TestClient, db_session: Session) -> None:
    email, _ = register(client, email="single@example.com")
    register(client, email="SINGLE@example.com")

    count = db_session.scalar(select(func.count()).select_from(User).where(User.email == email))
    assert count == 1


def test_sessions_are_isolated_between_users(client: TestClient, session_cookie_name: str) -> None:
    email_a, response_a = register(client)
    id_a = response_a.json()["id"]
    cookie_a = client.cookies.get(session_cookie_name)
    assert cookie_a

    client.cookies.clear()
    email_b, response_b = register(client)
    id_b = response_b.json()["id"]
    cookie_b = client.cookies.get(session_cookie_name)
    client.cookies.clear()

    assert id_a != id_b

    me_a = client.get("/auth/me", headers={"Cookie": f"{session_cookie_name}={cookie_a}"})
    assert me_a.status_code == 200
    assert me_a.json()["id"] == id_a
    assert me_a.json()["email"] == email_a

    me_b = client.get("/auth/me", headers={"Cookie": f"{session_cookie_name}={cookie_b}"})
    assert me_b.status_code == 200
    assert me_b.json()["id"] == id_b
    assert me_b.json()["email"] == email_b


def test_session_row_tracks_expiry(client: TestClient, db_session: Session) -> None:
    register(client)
    session = db_session.scalar(select(AuthSession))
    assert session is not None
    assert session.expires_at > datetime.now(UTC)
    assert session.revoked_at is None
