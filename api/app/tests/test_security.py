"""Security-focused tests: cookies, CSRF, uniqueness, isolation, and route sweeps.

Beyond the per-resource isolation tests in the feature suites, this module
sweeps the whole route table so a newly added endpoint cannot ship unprotected:
every route outside the documented anonymous allowlist must reject anonymous
callers with 401, and every state-changing route must reject requests without a
valid CSRF token with 403.
"""

import re
from datetime import UTC, datetime

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_token
from app.main import app
from app.models.session import Session as AuthSession
from app.models.user import User
from app.tests.support import (
    create_portfolio,
    create_section,
    list_pages,
    register,
    unique_email,
    unique_slug,
    upload_media,
)


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


# ---------------------------------------------------------------------------
# Route-table sweeps
# ---------------------------------------------------------------------------

# The only routes an anonymous caller may reach. Everything else must demand a
# session; the ``/public/*`` prefix is the dedicated, read-only published-site
# surface and is gated on publication state instead.
_ANONYMOUS_ALLOWLIST = {"/health", "/auth/register", "/auth/login"}
_PARAM_PATTERN = re.compile(r"\{[^}]+\}")
_ROUTE_SWEEP_MINIMUM = 30


def _api_routes() -> list[APIRoute]:
    """Return every FastAPI route registered on the application.

    Walks included routers as well as direct routes so the sweep keeps working
    even if FastAPI's router-inclusion internals change shape.
    """
    routes: list[APIRoute] = []
    for entry in app.routes:
        if isinstance(entry, APIRoute):
            routes.append(entry)
            continue
        router = getattr(entry, "original_router", None)
        if router is None:
            continue
        for sub in router.routes:
            if isinstance(sub, APIRoute):
                routes.append(sub)
    return routes


def _is_anonymous_route(path: str) -> bool:
    return path in _ANONYMOUS_ALLOWLIST or path.startswith("/public/")


def _fill_path(path: str, values: dict[str, str]) -> str:
    """Substitute concrete ids for every path parameter."""

    def replace(match: re.Match[str]) -> str:
        name = match.group(0)[1:-1]
        return values.get(name, "00000000-0000-0000-0000-000000000000")

    return _PARAM_PATTERN.sub(replace, path)


def test_every_protected_route_rejects_anonymous_requests() -> None:
    """No route outside the allowlist may serve an anonymous caller."""
    anonymous = TestClient(app)
    routes = [route for route in _api_routes() if not _is_anonymous_route(route.path)]
    # Guard against the route walk silently finding nothing after an upgrade.
    assert len(routes) >= _ROUTE_SWEEP_MINIMUM

    for route in routes:
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            response = anonymous.request(method, _fill_path(route.path, {}))
            assert response.status_code == 401, (
                f"{method} {route.path} answered {response.status_code} "
                f"to an anonymous caller (expected 401)."
            )


def test_every_state_changing_route_requires_a_csrf_token(client: TestClient) -> None:
    """No write route may accept an authenticated request without CSRF.

    The request targets real owned resources so ownership checks pass and the
    only possible failure is the missing CSRF header.
    """
    register(client)
    slug = unique_slug("sweep")
    portfolio_id = create_portfolio(client, name="Sweep", slug=slug).json()["id"]
    homepage = next(page for page in list_pages(client, portfolio_id).json() if page["is_homepage"])
    section_id = create_section(client, homepage["id"]).json()["id"]
    media_id = upload_media(client, portfolio_id).json()["id"]
    values = {
        "portfolio_id": portfolio_id,
        "page_id": homepage["id"],
        "section_id": section_id,
        "media_id": media_id,
        "template_id": "starter",
    }

    write_routes = [
        route
        for route in _api_routes()
        if (route.methods - {"GET", "HEAD", "OPTIONS"}) and not _is_anonymous_route(route.path)
    ]
    assert len(write_routes) >= _ROUTE_SWEEP_MINIMUM - 10

    for route in write_routes:
        for method in sorted(route.methods - {"GET", "HEAD", "OPTIONS"}):
            response = client.request(method, _fill_path(route.path, values), json={})
            assert response.status_code == 403, (
                f"{method} {route.path} answered {response.status_code} "
                f"without a CSRF header (expected 403)."
            )
