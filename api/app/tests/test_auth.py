"""Authentication API tests: register, login, me, and logout."""

from datetime import UTC

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.session import Session as AuthSession
from app.models.user import User
from app.tests.support import DEFAULT_PASSWORD, register, unique_email


def test_register_creates_user_and_session(client: TestClient) -> None:
    email, response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert body["is_active"] is True
    assert set(body) == {"id", "email", "display_name", "is_active", "created_at"}
    assert "password" not in str(body).lower()

    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_register_never_returns_password_hash(client: TestClient, db_session: Session) -> None:
    email, response = register(client, password="s3cret-passphrase")

    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    assert user.password_hash != "s3cret-passphrase"
    assert "s3cret-passphrase" not in response.text


def test_register_rejects_duplicate_email_case_insensitive(client: TestClient) -> None:
    email, _ = register(client, email="Dupe@example.com")
    _, response = register(client, email="dupe@example.com")

    assert response.status_code == 409


def test_register_rejects_invalid_email(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": DEFAULT_PASSWORD, "display_name": "X"},
    )
    assert response.status_code == 422


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"email": unique_email(), "password": "short", "display_name": "X"},
    )
    assert response.status_code == 422


def test_register_rejects_blank_display_name(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"email": unique_email(), "password": DEFAULT_PASSWORD, "display_name": "   "},
    )
    assert response.status_code == 422


def test_login_succeeds_with_valid_credentials(client: TestClient) -> None:
    email, _ = register(client)
    client.cookies.clear()

    response = client.post(
        "/auth/login", json={"email": email.upper(), "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["email"] == email
    assert "password" not in response.text.lower()


def test_login_rejects_invalid_password_with_generic_message(client: TestClient) -> None:
    email, _ = register(client)
    client.cookies.clear()

    response = client.post("/auth/login", json={"email": email, "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_unknown_email_uses_same_generic_message(client: TestClient) -> None:
    response = client.post(
        "/auth/login", json={"email": unique_email(), "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_me_requires_authentication(client: TestClient) -> None:
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated."


def test_logout_invalidates_session_and_old_cookie_is_rejected(
    client: TestClient, session_cookie_name: str, csrf_cookie_name: str
) -> None:
    register(client)
    raw_session = client.cookies.get(session_cookie_name)
    csrf_token = client.cookies.get(csrf_cookie_name)
    assert raw_session and csrf_token

    logout = client.post("/auth/logout", headers={"X-CSRF-Token": csrf_token})
    assert logout.status_code == 204

    reused = client.get("/auth/me", headers={"Cookie": f"{session_cookie_name}={raw_session}"})
    assert reused.status_code == 401


def test_logout_requires_csrf(client: TestClient) -> None:
    register(client)

    response = client.post("/auth/logout")

    assert response.status_code == 403


def test_logout_clears_cookies(
    client: TestClient, session_cookie_name: str, csrf_cookie_name: str
) -> None:
    register(client)
    csrf_token = client.cookies.get(csrf_cookie_name)

    client.post("/auth/logout", headers={"X-CSRF-Token": csrf_token})

    assert client.cookies.get(session_cookie_name) is None
    assert client.cookies.get(csrf_cookie_name) is None


def test_expired_session_is_rejected(client: TestClient, db_session: Session) -> None:
    from datetime import datetime, timedelta

    register(client)
    session = db_session.scalar(select(AuthSession))
    assert session is not None
    session.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    response = client.get("/auth/me")
    assert response.status_code == 401


def test_revoked_session_is_rejected(client: TestClient, db_session: Session) -> None:
    from datetime import datetime

    register(client)
    session = db_session.scalar(select(AuthSession))
    assert session is not None
    session.revoked_at = datetime.now(UTC)
    db_session.commit()

    response = client.get("/auth/me")
    assert response.status_code == 401


def test_disabled_user_cannot_login(client: TestClient, db_session: Session) -> None:
    email, _ = register(client)
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.is_active = False
    db_session.commit()
    client.cookies.clear()

    response = client.post("/auth/login", json={"email": email, "password": DEFAULT_PASSWORD})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_disabled_user_existing_session_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    email, _ = register(client)
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    user.is_active = False
    db_session.commit()

    response = client.get("/auth/me")
    assert response.status_code == 401
