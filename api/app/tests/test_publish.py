"""Publication, unpublish, and draft preview API tests.

Coverage: atomic snapshot creation, version numbering and pointer moves,
immutability of old snapshots, publication validation failures leaving the
previous version intact, draft/published separation, CSRF + ownership on every
endpoint, and the authenticated live-draft preview.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.navigation import NavigationDestinationType, NavigationItem, NavigationLocation
from app.models.page import Page
from app.models.page_section import PageSection
from app.models.portfolio import Portfolio, PortfolioStatus
from app.models.portfolio_version import PortfolioVersion
from app.tests.support import (
    create_portfolio,
    create_section,
    csrf_headers_for,
    list_pages,
    put_navigation,
    register,
    unique_slug,
    update_section,
    upload_media,
)


def _setup_portfolio(client: TestClient, *, name: str = "Site") -> str:
    register(client)
    response = create_portfolio(client, name=name, slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def _homepage_id(client: TestClient, portfolio_id: str) -> str:
    pages = list_pages(client, portfolio_id).json()
    homepage = next(page for page in pages if page["is_homepage"])
    return homepage["id"]


def _publish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/publish", headers=csrf_headers_for(client))


def _unpublish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/unpublish", headers=csrf_headers_for(client))


def _versions(db: Session, portfolio_id: str) -> list[PortfolioVersion]:
    db.expire_all()
    return list(
        db.scalars(
            select(PortfolioVersion)
            .where(PortfolioVersion.portfolio_id == uuid.UUID(portfolio_id))
            .order_by(PortfolioVersion.version_number)
        )
    )


def _portfolio(db: Session, portfolio_id: str) -> Portfolio:
    db.expire_all()
    portfolio = db.get(Portfolio, uuid.UUID(portfolio_id))
    assert portfolio is not None
    return portfolio


def test_publish_creates_immutable_snapshot_and_updates_status(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(
        client, home_id, section_type="hero", content={"heading": "Original heading"}
    )
    assert created.status_code == 201
    upload_media(client, portfolio_id, filename="hero.png", alt_text="Hero image")

    response = _publish(client, portfolio_id)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == PortfolioStatus.PUBLISHED.value
    assert data["version_number"] == 1
    assert data["public_path"].startswith("/p/")
    assert data["published_at"] is not None

    versions = _versions(db_session, portfolio_id)
    assert len(versions) == 1
    snapshot = versions[0].snapshot_json
    assert snapshot["snapshot_version"] == 1
    assert snapshot["portfolio"]["id"] == portfolio_id
    assert [page["slug"] for page in snapshot["pages"]] == [
        "home",
        "about",
        "work",
        "projects",
        "contact",
    ]
    home = next(page for page in snapshot["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Original heading"
    assert snapshot["theme"]["tokens"] != {}
    assert snapshot["media"][0]["url"].startswith("/media/")
    assert snapshot["navigation"] == []

    portfolio = _portfolio(db_session, portfolio_id)
    assert portfolio.status == PortfolioStatus.PUBLISHED.value
    assert portfolio.current_published_version_id == versions[0].id
    assert portfolio.published_at is not None

    # A draft save must not mutate the stored snapshot.
    section_id = home["sections"][0]["id"]
    assert update_section(client, section_id, content={"heading": "Draft edit"}).status_code == 200
    db_session.expire_all()
    versions_after = _versions(db_session, portfolio_id)
    assert len(versions_after) == 1
    assert (
        versions_after[0].snapshot_json["pages"][0]["sections"][0]["content"]["heading"]
        == "Original heading"
    )


def test_publish_requires_authentication(client: TestClient, client_factory) -> None:
    fresh = client_factory()
    portfolio_id = _setup_portfolio(client)
    response = fresh.post(f"/portfolios/{portfolio_id}/publish")
    assert response.status_code == 401


def test_publish_requires_csrf_token(client: TestClient, db_session: Session) -> None:
    portfolio_id = _setup_portfolio(client)
    response = client.post(f"/portfolios/{portfolio_id}/publish")
    assert response.status_code == 403
    portfolio = _portfolio(db_session, portfolio_id)
    assert portfolio.status == PortfolioStatus.DRAFT.value
    assert portfolio.current_published_version_id is None


def test_other_user_cannot_publish_or_preview(client: TestClient, client_factory) -> None:
    owner_id = _setup_portfolio(client, name="Owner site")

    other = client_factory()
    register(other)
    assert _publish(other, owner_id).status_code == 404
    assert other.get(f"/portfolios/{owner_id}/preview").status_code == 404
    assert _unpublish(other, owner_id).status_code == 404


def test_publish_validation_requires_a_homepage(client: TestClient, db_session: Session) -> None:
    portfolio_id = _setup_portfolio(client)
    # The API never unsets a homepage; corrupt the draft directly instead.
    db_session.execute(
        update(Page).where(Page.portfolio_id == uuid.UUID(portfolio_id)).values(is_homepage=False)
    )
    db_session.commit()

    response = _publish(client, portfolio_id)
    assert response.status_code == 422
    assert "homepage" in response.json()["detail"]

    portfolio = _portfolio(db_session, portfolio_id)
    assert portfolio.status == PortfolioStatus.DRAFT.value
    assert _versions(db_session, portfolio_id) == []


def test_publish_validation_requires_at_least_one_page(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    # The API guards homepage deletion; wipe the draft directly instead.
    db_session.execute(delete(Page).where(Page.portfolio_id == uuid.UUID(portfolio_id)))
    db_session.commit()

    response = _publish(client, portfolio_id)
    assert response.status_code == 422
    assert "page" in response.json()["detail"].lower()
    assert _versions(db_session, portfolio_id) == []


def test_publish_rejects_corrupt_section_and_keeps_previous_version(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    create_section(client, home_id, section_type="hero", content={"heading": "First"})

    assert _publish(client, portfolio_id).status_code == 200
    first = _versions(db_session, portfolio_id)[0]
    published_at_before = _portfolio(db_session, portfolio_id).published_at

    # Corrupt the draft directly, bypassing API validation.
    home_uuid = uuid.UUID(home_id)
    section = db_session.scalar(select(PageSection).where(PageSection.page_id == home_uuid))
    assert section is not None
    section.section_type = "removed_section_type"
    db_session.commit()

    response = _publish(client, portfolio_id)
    assert response.status_code == 422
    assert "removed_section_type" in response.json()["detail"]

    portfolio = _portfolio(db_session, portfolio_id)
    versions = _versions(db_session, portfolio_id)
    assert portfolio.status == PortfolioStatus.PUBLISHED.value
    assert portfolio.current_published_version_id == first.id
    assert portfolio.published_at == published_at_before
    assert len(versions) == 1
    assert versions[0].snapshot_json["pages"][0]["sections"][0]["content"]["heading"] == "First"


def test_publish_rejects_incomplete_required_section_content(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    # The write path stores empty defaults for omitted required fields, so a
    # half-finished section is a valid draft but not publishable.
    created = create_section(client, home_id, section_type="hero")
    assert created.status_code == 201
    section_id = created.json()["id"]

    response = _publish(client, portfolio_id)
    assert response.status_code == 422
    assert "heading is required" in response.json()["detail"]
    assert _versions(db_session, portfolio_id) == []

    fixed = update_section(client, section_id, content={"heading": "Completed"})
    assert fixed.status_code == 200
    assert _publish(client, portfolio_id).status_code == 200


def test_publish_rejects_unsafe_external_navigation(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    db_session.add(
        NavigationItem(
            portfolio_id=uuid.UUID(portfolio_id),
            location=NavigationLocation.HEADER,
            label="Sneaky",
            destination_type=NavigationDestinationType.EXTERNAL_URL,
            external_url="javascript:alert(1)",
            sort_order=0,
            is_visible=True,
        )
    )
    db_session.commit()

    response = _publish(client, portfolio_id)
    assert response.status_code == 422
    assert "Sneaky" in response.json()["detail"]
    assert _versions(db_session, portfolio_id) == []


def test_republish_appends_new_version_without_touching_the_old_one(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(client, home_id, section_type="hero", content={"heading": "v1 text"})
    section_id = created.json()["id"]

    assert _publish(client, portfolio_id).status_code == 200
    update_section(client, section_id, content={"heading": "v2 text"})
    second = _publish(client, portfolio_id)
    assert second.status_code == 200
    assert second.json()["version_number"] == 2

    versions = _versions(db_session, portfolio_id)
    assert [version.version_number for version in versions] == [1, 2]
    assert versions[0].snapshot_json["pages"][0]["sections"][0]["content"]["heading"] == "v1 text"
    assert versions[1].snapshot_json["pages"][0]["sections"][0]["content"]["heading"] == "v2 text"

    portfolio = _portfolio(db_session, portfolio_id)
    assert portfolio.current_published_version_id == versions[1].id
    assert portfolio.status == PortfolioStatus.PUBLISHED.value


def test_unpublish_keeps_history_and_clears_published_state(
    client: TestClient, db_session: Session
) -> None:
    portfolio_id = _setup_portfolio(client)
    assert _publish(client, portfolio_id).status_code == 200
    version_id = _portfolio(db_session, portfolio_id).current_published_version_id

    response = _unpublish(client, portfolio_id)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == PortfolioStatus.DRAFT.value
    assert data["published_at"] is None

    portfolio = _portfolio(db_session, portfolio_id)
    assert portfolio.status == PortfolioStatus.DRAFT.value
    # History is retained so public rendering must gate on ``status`` (404).
    assert portfolio.current_published_version_id == version_id
    assert len(_versions(db_session, portfolio_id)) == 1

    # Unpublishing an already-draft portfolio is a harmless no-op.
    assert _unpublish(client, portfolio_id).status_code == 200

    # Re-publishing creates the next version, not a reuse of the old one.
    assert _publish(client, portfolio_id).status_code == 200
    versions = _versions(db_session, portfolio_id)
    assert [version.version_number for version in versions] == [1, 2]


def test_draft_saves_never_change_published_state(client: TestClient, db_session: Session) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(client, home_id, section_type="hero", content={"heading": "Live site"})
    section_id = created.json()["id"]
    first_publish = _publish(client, portfolio_id)
    assert first_publish.status_code == 200, first_publish.json()
    before = _portfolio(db_session, portfolio_id)
    version_id, published_at = before.current_published_version_id, before.published_at

    update_section(client, section_id, content={"heading": "Unpublished edit"})
    put_navigation(
        client,
        portfolio_id,
        items=[
            {
                "location": "header",
                "label": "Home",
                "destination_type": "page",
                "page_id": home_id,
            }
        ],
    )

    after = _portfolio(db_session, portfolio_id)
    assert after.status == PortfolioStatus.PUBLISHED.value
    assert after.current_published_version_id == version_id
    assert after.published_at == published_at
    assert len(_versions(db_session, portfolio_id)) == 1


def test_preview_returns_live_draft_for_owner(client: TestClient, client_factory) -> None:
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(client, home_id, section_type="hero", content={"heading": "Draft one"})
    section_id = created.json()["id"]

    response = client.get(f"/portfolios/{portfolio_id}/preview")
    assert response.status_code == 200
    data = response.json()
    assert data["portfolio"]["id"] == portfolio_id
    assert data["portfolio"]["status"] == PortfolioStatus.DRAFT.value
    assert data["portfolio"]["published_at"] is None
    assert len(data["pages"]) == 5
    home = next(page for page in data["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Draft one"
    assert data["theme"]["tokens"] != {}
    assert "snapshot_version" not in data

    # The preview always reflects the latest draft, even mid-session.
    update_section(client, section_id, content={"heading": "Draft two"})
    refreshed = client.get(f"/portfolios/{portfolio_id}/preview").json()
    home = next(page for page in refreshed["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Draft two"

    # Preview never requires CSRF and never exposes another user's draft.
    assert client.get(f"/portfolios/{portfolio_id}/preview").status_code == 200
    fresh = client_factory()
    assert fresh.get(f"/portfolios/{portfolio_id}/preview").status_code == 401


def test_preview_and_snapshot_include_navigation_items(
    client: TestClient, db_session: Session
) -> None:
    """Regression: navigation payloads must validate against PreviewResponse.

    The snapshot navigation entries previously omitted ``portfolio_id``, which
    made both the draft preview and the public resolver fail validation as
    soon as an owner configured navigation.
    """
    portfolio_id = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    put_navigation(
        client,
        portfolio_id,
        items=[
            {
                "location": "header",
                "label": "Home",
                "destination_type": "page",
                "page_id": home_id,
            }
        ],
    )

    preview = client.get(f"/portfolios/{portfolio_id}/preview")
    assert preview.status_code == 200
    nav = preview.json()["navigation"]
    assert len(nav) == 1
    assert nav[0]["portfolio_id"] == portfolio_id
    assert nav[0]["label"] == "Home"

    assert _publish(client, portfolio_id).status_code == 200
    versions = _versions(db_session, portfolio_id)
    snapshot_nav = versions[0].snapshot_json["navigation"]
    assert snapshot_nav[0]["portfolio_id"] == portfolio_id
