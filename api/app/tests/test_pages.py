"""Page API tests.

Coverage: starter-page seeding, CRUD, homepage invariant (single homepage,
reassignment, delete guard, auto-homepage), slug derivation/validation/
uniqueness within a portfolio, explicit ordering, cross-user isolation, CSRF,
and database-level constraint enforcement.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.page import Page
from app.models.portfolio import Portfolio
from app.tests.support import (
    create_page,
    create_portfolio,
    delete_page,
    fetch_page,
    list_pages,
    register,
    reorder_pages,
    unique_slug,
    update_page,
)

STARTER_SLUGS = ["home", "about", "work", "projects", "contact"]


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def test_portfolio_creation_seeds_starter_pages(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = list_pages(client, portfolio_id)
    assert response.status_code == 200
    pages = response.json()

    assert [page["slug"] for page in pages] == STARTER_SLUGS
    assert [page["sort_order"] for page in pages] == [0, 1, 2, 3, 4]
    assert [page["is_homepage"] for page in pages] == [True, False, False, False, False]
    assert all(page["status"] == "draft" for page in pages)
    assert all(page["is_visible"] is True for page in pages)
    assert all(page["portfolio_id"] == portfolio_id for page in pages)


def test_create_page_returns_201_with_defaults(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = create_page(client, portfolio_id, title="Gallery")
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Gallery"
    assert data["slug"] == "gallery"
    assert data["is_homepage"] is False
    assert data["is_visible"] is True
    assert data["status"] == "draft"
    assert data["sort_order"] == 5  # after the five starter pages
    assert data["seo_title"] is None
    assert uuid.UUID(data["id"]) is not None


def test_create_page_unauthenticated_is_401(client: TestClient) -> None:
    response = client.post(f"/portfolios/{uuid.uuid4()}/pages", json={"title": "Nope"})
    assert response.status_code == 401


def test_create_page_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = client.post(f"/portfolios/{portfolio_id}/pages", json={"title": "No CSRF"})
    assert response.status_code == 403


def test_create_page_derives_slug_from_title(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = create_page(client, portfolio_id, title="My Great Page!")
    assert response.status_code == 201
    assert response.json()["slug"] == "my-great-page"


def test_create_page_rejects_invalid_slug(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    for bad in ["Bad Slug", "bad--slug", "-bad", "bad_slug"]:
        response = create_page(client, portfolio_id, title="Ok", slug=bad)
        assert response.status_code == 422, bad


def test_create_page_allows_reserved_platform_slug(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = create_page(client, portfolio_id, title="Reserved", slug="admin")
    assert response.status_code == 201
    assert response.json()["slug"] == "admin"


def test_create_page_duplicate_slug_in_portfolio_is_409(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = create_page(client, portfolio_id, title="About", slug="about")
    assert response.status_code == 409


def test_same_slug_allowed_across_portfolios(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)

    r1 = create_page(client, first, title="Gallery", slug="gallery")
    r2 = create_page(client, second, title="Gallery", slug="gallery")
    assert r1.status_code == 201
    assert r2.status_code == 201


def test_list_or_read_another_users_pages_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a, display_name="A")
    register(client_b, display_name="B")

    portfolio_id = _create_portfolio(client_a)
    page_id = list_pages(client_a, portfolio_id).json()[0]["id"]

    assert list_pages(client_b, portfolio_id).status_code == 404
    assert fetch_page(client_b, page_id).status_code == 404


def test_read_own_page_returns_200(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = list_pages(client, portfolio_id).json()[0]["id"]

    response = fetch_page(client, page_id)
    assert response.status_code == 200
    assert response.json()["id"] == page_id


def test_update_own_page_returns_200(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Draft Page").json()["id"]

    response = update_page(
        client,
        page_id,
        title="Final Page",
        slug="final-page",
        is_visible=False,
        seo_title="SEO",
        seo_description="Desc",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Final Page"
    assert data["slug"] == "final-page"
    assert data["is_visible"] is False
    assert data["seo_title"] == "SEO"
    assert data["seo_description"] == "Desc"


def test_update_page_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Page").json()["id"]

    response = client.patch(f"/pages/{page_id}", json={"title": "Nope"})
    assert response.status_code == 403


def test_update_page_rejects_clearing_required_fields(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Page").json()["id"]

    assert update_page(client, page_id, title=None).status_code == 422
    assert update_page(client, page_id, slug=None).status_code == 422


def test_update_page_rejects_invalid_slug(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Page").json()["id"]

    assert update_page(client, page_id, slug="Bad Slug").status_code == 422


def test_update_page_duplicate_slug_is_409(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Page", slug="gallery").json()["id"]

    response = update_page(client, page_id, slug="about")
    assert response.status_code == 409


def test_update_another_users_page_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    page_id = list_pages(client_a, portfolio_id).json()[0]["id"]

    assert update_page(client_b, page_id, title="Hacked").status_code == 404
    assert delete_page(client_b, page_id).status_code == 404


def test_reassign_homepage_keeps_single_homepage(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = list_pages(client, portfolio_id).json()
    new_home_id = next(page["id"] for page in pages if page["slug"] == "about")

    response = update_page(client, new_home_id, is_homepage=True)
    assert response.status_code == 200
    assert response.json()["is_homepage"] is True

    pages_after = list_pages(client, portfolio_id).json()
    homepage_flags = {page["id"]: page["is_homepage"] for page in pages_after}
    assert sum(homepage_flags.values()) == 1
    assert homepage_flags[new_home_id] is True
    old_home_id = next(page["id"] for page in pages if page["slug"] == "home")
    assert homepage_flags[old_home_id] is False


def test_cannot_unset_homepage(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    home_id = list_pages(client, portfolio_id).json()[0]["id"]

    response = update_page(client, home_id, is_homepage=False)
    assert response.status_code == 409


def test_cannot_delete_homepage(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    home_id = list_pages(client, portfolio_id).json()[0]["id"]

    response = delete_page(client, home_id)
    assert response.status_code == 409

    # Still present.
    assert fetch_page(client, home_id).status_code == 200


def test_delete_non_homepage_returns_204_and_is_gone(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Temp").json()["id"]

    response = delete_page(client, page_id)
    assert response.status_code == 204
    assert fetch_page(client, page_id).status_code == 404


def test_delete_page_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = create_page(client, portfolio_id, title="Temp").json()["id"]

    response = client.delete(f"/pages/{page_id}")
    assert response.status_code == 403


def test_first_page_in_empty_portfolio_becomes_homepage(
    client: TestClient, db_session: Session
) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    db_session.execute(delete(Page).where(Page.portfolio_id == uuid.UUID(portfolio_id)))
    db_session.commit()

    response = create_page(client, portfolio_id, title="Solo", is_homepage=False)
    assert response.status_code == 201
    assert response.json()["is_homepage"] is True


def test_reorder_pages_updates_order(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = list_pages(client, portfolio_id).json()
    reversed_ids = [page["id"] for page in reversed(pages)]

    response = reorder_pages(client, portfolio_id, reversed_ids)
    assert response.status_code == 200
    assert [page["id"] for page in response.json()] == reversed_ids
    assert [page["sort_order"] for page in response.json()] == [0, 1, 2, 3, 4]

    assert [page["id"] for page in list_pages(client, portfolio_id).json()] == reversed_ids


def test_reorder_pages_requires_full_permutation(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = list_pages(client, portfolio_id).json()
    ids = [page["id"] for page in pages]

    # Missing one page.
    assert reorder_pages(client, portfolio_id, ids[:-1]).status_code == 422
    # Duplicate an id.
    assert reorder_pages(client, portfolio_id, ids[:-1] + [ids[0]]).status_code == 422
    # Foreign / unknown id.
    assert reorder_pages(client, portfolio_id, ids[:-1] + [str(uuid.uuid4())]).status_code == 422


def test_reorder_pages_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    ids = [page["id"] for page in list_pages(client, portfolio_id).json()]

    response = client.put(f"/portfolios/{portfolio_id}/pages/order", json={"page_ids": ids})
    assert response.status_code == 403


def test_reorder_another_users_pages_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    ids = [page["id"] for page in list_pages(client_a, portfolio_id).json()]

    assert reorder_pages(client_b, portfolio_id, ids).status_code == 404


def test_database_enforces_unique_slug_within_portfolio(
    db_session: Session, client_factory
) -> None:
    client = client_factory()
    register(client)
    portfolio_id = _create_portfolio(client)

    existing = Page(
        portfolio_id=uuid.UUID(portfolio_id),
        title="Home Copy",
        slug="home",
        is_homepage=False,
        is_visible=True,
        status="draft",
        sort_order=99,
    )
    db_session.add(existing)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_database_enforces_single_homepage(db_session: Session, client_factory) -> None:
    client = client_factory()
    register(client)
    portfolio_id = _create_portfolio(client)

    second_home = Page(
        portfolio_id=uuid.UUID(portfolio_id),
        title="Second Home",
        slug="second-home",
        is_homepage=True,
        is_visible=True,
        status="draft",
        sort_order=99,
    )
    db_session.add(second_home)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_pages_isolated_by_portfolio_for_same_user(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)

    create_page(client, first, title="Gallery", slug="gallery")

    first_slugs = {page["slug"] for page in list_pages(client, first).json()}
    second_slugs = {page["slug"] for page in list_pages(client, second).json()}
    assert "gallery" in first_slugs
    assert "gallery" not in second_slugs


def test_pages_scope_to_owning_portfolio_in_db(db_session: Session, client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = list(
        db_session.scalars(select(Page).where(Page.portfolio_id == uuid.UUID(portfolio_id)))
    )
    assert len(pages) == 5
    assert db_session.scalar(select(Portfolio)) is not None
