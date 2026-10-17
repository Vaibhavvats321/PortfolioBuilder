"""Portfolio API tests.

These tests cover creation, listing, retrieval, updating, deletion, ownership
enforcement, cross-user isolation, slug validation/uniqueness, pagination
defaults, and session/CSRF behavior. The test setup uses isolated test
databases and transactional isolation (via savepoints) to keep tests
deterministic.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.models.user import User
from app.tests.support import (
    create_portfolio,
    csrf_headers_for,
    register,
    unique_slug,
)


def test_create_portfolio_authenticated_returns_201_and_defaults(client: TestClient) -> None:
    register(client)
    response = create_portfolio(client, name="My Portfolio", slug="my-portfolio")

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Portfolio"
    assert data["slug"] == "my-portfolio"
    assert data["description"] is None
    assert data["status"] == "draft"
    assert data["settings_json"] == {}
    assert uuid.UUID(data["id"]) is not None
    assert uuid.UUID(data["owner_id"]) is not None
    assert "created_at" in data
    assert "updated_at" in data


def test_create_portfolio_unauthenticated_is_401(client: TestClient) -> None:
    # No registration; no session cookie.
    response = client.post("/portfolios", json={"name": "No Auth"})
    assert response.status_code == 401


def test_create_portfolio_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    client.post("/auth/logout", headers=csrf_headers_for(client))  # ensure clean state
    register(client)  # new session
    # Post without X-CSRF-Token
    response = client.post("/portfolios", json={"name": "No CSRF"})
    assert response.status_code == 403


def test_create_portfolio_omits_slug_and_derives_it(client: TestClient) -> None:
    register(client)
    response = create_portfolio(client, name="My First Site")

    assert response.status_code == 201
    data = response.json()
    assert data["slug"] == "my-first-site"
    assert data["name"] == "My First Site"


def test_create_portfolio_cannot_derive_slug_returns_422(client: TestClient) -> None:
    register(client)
    response = create_portfolio(client, name="!!!")

    assert response.status_code == 422
    detail = response.json().get("detail")
    assert isinstance(detail, str)
    assert "slug" in detail.lower()


def test_list_portfolios_returns_only_current_user(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()

    register(client_a, display_name="A")
    register(client_b, display_name="B")

    # Create portfolios for each user
    resp_a1 = create_portfolio(client_a, name="A1")
    resp_a2 = create_portfolio(client_a, name="A2")
    create_portfolio(client_b, name="B1")

    assert resp_a1.status_code == 201
    assert resp_a2.status_code == 201

    list_a = client_a.get("/portfolios")
    list_b = client_b.get("/portfolios")

    assert list_a.status_code == 200
    assert list_b.status_code == 200

    data_a = list_a.json()
    data_b = list_b.json()

    # Only own portfolios
    assert len(data_a) == 2
    assert len(data_b) == 1
    assert data_b[0]["name"] == "B1"
    # No leak of A's names into B's list
    assert all(item["name"] != "A1" and item["name"] != "A2" for item in data_b)


def test_get_own_portfolio_returns_200(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Read Me")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.get(f"/portfolios/{portfolio_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == portfolio_id
    assert resp.json()["name"] == "Read Me"


def test_get_another_users_portfolio_returns_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    created = create_portfolio(client_a, name="Secret")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client_b.get(f"/portfolios/{portfolio_id}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Portfolio not found."


def test_update_own_portfolio_returns_200(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Old Name", slug="old-name", description="desc")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    updated_resp = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"name": "New Name", "slug": "new-name", "description": None},
        headers=csrf_headers_for(client),
    )
    assert updated_resp.status_code == 200
    data = updated_resp.json()
    assert data["name"] == "New Name"
    assert data["slug"] == "new-name"
    assert data["description"] is None


def test_patch_update_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="To Update", slug="to-update")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.patch(f"/portfolios/{portfolio_id}", json={"name": "Nope"})
    assert resp.status_code == 403


def test_patch_update_with_no_changes_returns_200_unchanged(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Unchanged", slug="unchanged")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.patch(f"/portfolios/{portfolio_id}", json={}, headers=csrf_headers_for(client))
    assert resp.status_code == 200
    assert resp.json()["slug"] == "unchanged"


def test_patch_update_another_users_portfolio_returns_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    created = create_portfolio(client_a, name="Owned By A")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client_b.patch(
        f"/portfolios/{portfolio_id}",
        json={"name": "Steal"},
        headers=csrf_headers_for(client_b),
    )
    assert resp.status_code == 404


def test_patch_update_rejects_invalid_slug(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Bad Slug", slug="bad-slug")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"slug": "Bad Slug"},
        headers=csrf_headers_for(client),
    )
    assert resp.status_code == 422


def test_patch_update_rejects_reserved_slug(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Reserved", slug="reserved")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"slug": "admin"},
        headers=csrf_headers_for(client),
    )
    assert resp.status_code == 422


def test_delete_own_portfolio_returns_204_and_is_gone(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="To Delete")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.delete(f"/portfolios/{portfolio_id}", headers=csrf_headers_for(client))
    assert resp.status_code == 204

    # Subsequently fetching the deleted portfolio returns 404.
    after = client.get(f"/portfolios/{portfolio_id}")
    assert after.status_code == 404


def test_delete_portfolio_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="No CSRF Del")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client.delete(f"/portfolios/{portfolio_id}")
    assert resp.status_code == 403


def test_delete_another_users_portfolio_returns_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    created = create_portfolio(client_a, name="Not Yours")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    resp = client_b.delete(f"/portfolios/{portfolio_id}", headers=csrf_headers_for(client_b))
    assert resp.status_code == 404


def test_duplicate_slug_is_409(client: TestClient) -> None:
    register(client)
    first = create_portfolio(client, name="Same", slug="same")
    assert first.status_code == 201

    second = create_portfolio(client, name="Same Too", slug="same")
    assert second.status_code == 409
    assert second.json()["detail"] == "A portfolio with this slug already exists."


def test_derived_slug_duplicate_triggers_409(client: TestClient) -> None:
    register(client)
    first = create_portfolio(client, name="Duplicate Me")
    assert first.status_code == 201
    # Attempt to create another portfolio that derives to same slug? Impossible unless same name;
    # different names usually give different slugs. But test with same name again.
    second = create_portfolio(client, name="Duplicate Me")
    assert second.status_code == 409


def test_duplicate_names_are_allowed(client: TestClient) -> None:
    register(client)
    r1 = create_portfolio(client, name="Same Name", slug=unique_slug("p1"))
    r2 = create_portfolio(client, name="Same Name", slug=unique_slug("p2"))
    assert r1.status_code == 201
    assert r2.status_code == 201


def test_create_portfolio_rejects_invalid_slug_format(client: TestClient) -> None:
    register(client)
    r1 = create_portfolio(client, name="Bad", slug="bad--slug")
    r2 = create_portfolio(client, name="Bad", slug="-bad")
    r3 = create_portfolio(client, name="Bad", slug="bad_slug")  # underscore not allowed
    assert r1.status_code == 422
    assert r2.status_code == 422
    assert r3.status_code == 422


def test_create_portfolio_rejects_reservered_slug(client: TestClient) -> None:
    register(client)
    # Reserved: api, admin, dashboard, auth, health, login, logout, register, p, portfolios
    reserved = [
        "api",
        "admin",
        "dashboard",
        "auth",
        "health",
        "login",
        "logout",
        "register",
        "p",
        "portfolios",
    ]
    for slug in reserved:
        r = create_portfolio(client, name="X", slug=slug)
        assert r.status_code == 422


def test_update_portfolio_cannot_clear_name_or_slug_with_null(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="ClearTest", slug="cleartest")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    r1 = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"name": None},
        headers=csrf_headers_for(client),
    )
    r2 = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"slug": None},
        headers=csrf_headers_for(client),
    )
    assert r1.status_code == 422
    assert r2.status_code == 422


def test_create_portfolio_rejects_blank_display_name_equivalent(client: TestClient) -> None:
    register(client)
    # name with only spaces
    r = create_portfolio(client, name="   ")
    assert r.status_code == 422


def test_portfolio_name_length_validation(client: TestClient) -> None:
    register(client)
    long_name = "x" * 121
    r = create_portfolio(client, name=long_name)
    assert r.status_code == 422


def test_portfolio_slug_length_validation(client: TestClient) -> None:
    register(client)
    long_slug = "a" * 101
    r = create_portfolio(client, name="Valid", slug=long_slug)
    assert r.status_code == 422


def test_portfolio_description_length_validation(client: TestClient) -> None:
    register(client)
    long_desc = "x" * 501
    r = create_portfolio(client, name="Valid", slug=unique_slug(), description=long_desc)
    assert r.status_code == 422


def test_description_can_be_cleared_on_update(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Desc", slug="desc", description="has desc")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    r = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"description": ""},
        headers=csrf_headers_for(client),
    )
    assert r.status_code == 200
    assert r.json()["description"] is None


def test_database_enforces_unique_slug_constraint(db_session: Session, client_factory) -> None:
    client = client_factory()
    register(client)
    user = db_session.scalar(select(User))
    assert user is not None

    p1 = Portfolio(owner_id=user.id, name="A", slug="collide", status="draft")
    db_session.add(p1)
    db_session.commit()

    p2 = Portfolio(owner_id=user.id, name="B", slug="collide", status="draft")
    db_session.add(p2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_cross_user_isolation_after_delete(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    created = create_portfolio(client_a, name="A Portfolio")
    assert created.status_code == 201
    portfolio_id = created.json()["id"]

    # B cannot see A's portfolio
    b_get = client_b.get(f"/portfolios/{portfolio_id}")
    assert b_get.status_code == 404

    # B cannot update A's portfolio
    b_patch = client_b.patch(
        f"/portfolios/{portfolio_id}", json={"name": "Hacked"}, headers=csrf_headers_for(client_b)
    )
    assert b_patch.status_code == 404

    # B cannot delete A's portfolio
    b_del = client_b.delete(f"/portfolios/{portfolio_id}", headers=csrf_headers_for(client_b))
    assert b_del.status_code == 404

    # A's portfolio remains intact
    a_get = client_a.get(f"/portfolios/{portfolio_id}")
    assert a_get.status_code == 200


def test_list_portfolios_pagination_defaults(client: TestClient) -> None:
    register(client)
    # Create 3 portfolios
    for i in range(3):
        resp = create_portfolio(client, name=f"P{i}", slug=unique_slug(f"p{i}"))
        assert resp.status_code == 201

    list_resp = client.get("/portfolios")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 3  # all returned (<= default 50)


def test_list_portfolios_accepts_limit_and_offset(client: TestClient) -> None:
    register(client)
    # Create 5 portfolios
    for i in range(5):
        resp = create_portfolio(client, name=f"Q{i}", slug=unique_slug(f"q{i}"))
        assert resp.status_code == 201

    # limit 2, offset 1
    resp = client.get("/portfolios?limit=2&offset=1")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_portfolios_limit_cap_and_validation(client: TestClient) -> None:
    register(client)
    # limit > 100 should fail validation (ge/le enforced)
    resp = client.get("/portfolios?limit=101")
    assert resp.status_code == 422
    resp_bad = client.get("/portfolios?limit=0")
    assert resp_bad.status_code == 422
    resp_bad2 = client.get("/portfolios?offset=-1")
    assert resp_bad2.status_code == 422


def test_logout_prevents_subsequent_portfolio_access(client: TestClient) -> None:
    register(client)
    # Create a portfolio while logged in
    resp_create = create_portfolio(client, name="SessionTest", slug=unique_slug("sess"))
    assert resp_create.status_code == 201

    # Logout
    resp_logout = client.post("/auth/logout", headers=csrf_headers_for(client))
    assert resp_logout.status_code == 204

    # Subsequent attempts should be 401 (unauthenticated)
    resp_list = client.get("/portfolios")
    assert resp_list.status_code == 401

    # After logout the session cookie is cleared; a request without cookies gets 401.
    assert client.get("/portfolios").status_code == 401


def test_disabled_user_cannot_access_portfolios(client: TestClient, db_session: Session) -> None:
    register(client)
    user = db_session.scalar(select(User))
    assert user is not None
    user.is_active = False
    db_session.commit()

    resp = client.get("/portfolios")
    assert resp.status_code == 401


def test_portfolio_count_isolated_between_users(client_factory, db_session: Session) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    # A creates 2, B creates 1
    create_portfolio(client_a, name="A1", slug=unique_slug("a1"))
    create_portfolio(client_a, name="A2", slug=unique_slug("a2"))
    create_portfolio(client_b, name="B1", slug=unique_slug("b1"))

    a_count = db_session.scalar(
        select(func.count()).select_from(Portfolio).join(User, Portfolio.owner_id == User.id)
    )
    # Total across all users in test DB: 3
    assert a_count == 3

    # Per-user counts
    db_session.scalar(select(User).order_by(User.created_at.asc()))
    db_session.scalar(select(User).order_by(User.created_at.desc()).limit(1))
    # easier: fetch both
    users = list(db_session.scalars(select(User).order_by(User.created_at.asc())))
    assert len(users) == 2
    count_a = db_session.scalar(
        select(func.count()).select_from(Portfolio).where(Portfolio.owner_id == users[0].id)
    )
    count_b = db_session.scalar(
        select(func.count()).select_from(Portfolio).where(Portfolio.owner_id == users[1].id)
    )
    assert count_a + count_b == 3
    assert count_a == 2
    assert count_b == 1


def test_ports_owned_portfolio_by_nonexistent_id_is_404(client: TestClient) -> None:
    register(client)
    resp = client.get(f"/portfolios/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_update_portfolio_does_not_change_status_or_settings_json(client: TestClient) -> None:
    register(client)
    created = create_portfolio(client, name="Meta", slug="meta")
    assert created.status_code == 201
    orig = created.json()
    portfolio_id = orig["id"]

    resp = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"name": "Meta2"},
        headers=csrf_headers_for(client),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "draft"
    assert data["settings_json"] == {}
