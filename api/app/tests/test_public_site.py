"""Public website API tests (Phase 8).

Coverage: anonymous reads of the active published snapshot, 404 for draft,
unpublished, unknown, and corrupt sites, immediate cache invalidation on
publish/unpublish/portfolio update/delete, isolation of the public bundle
from draft edits, sitemap discovery limited to published sites, and public
media serving gated on publication state.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.portfolio_version import PortfolioVersion
from app.tests.support import (
    create_portfolio,
    create_section,
    csrf_headers_for,
    list_pages,
    png_bytes,
    put_navigation,
    register,
    unique_slug,
    update_section,
    upload_media,
)

_PRIVATE_DETAIL = "Portfolio not found."


def _setup_portfolio(client: TestClient, *, name: str = "Site") -> tuple[str, str]:
    """Register an owner and create a draft portfolio; return (id, slug)."""
    register(client)
    slug = unique_slug("site")
    response = create_portfolio(client, name=name, slug=slug)
    assert response.status_code == 201
    return response.json()["id"], slug


def _homepage_id(client: TestClient, portfolio_id: str) -> str:
    pages = list_pages(client, portfolio_id).json()
    homepage = next(page for page in pages if page["is_homepage"])
    return homepage["id"]


def _publish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/publish", headers=csrf_headers_for(client))


def _unpublish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/unpublish", headers=csrf_headers_for(client))


def _public_site(anonymous: TestClient, slug: str):
    return anonymous.get(f"/public/portfolios/{slug}")


def test_anonymous_visitor_reads_published_site(client: TestClient, client_factory) -> None:
    portfolio_id, slug = _setup_portfolio(client, name="Public Site")
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(
        client, home_id, section_type="hero", content={"heading": "Published heading"}
    )
    assert created.status_code == 201
    upload_media(client, portfolio_id, filename="hero.png", alt_text="Hero")
    put_navigation(
        client,
        portfolio_id,
        items=[
            {
                "location": "header",
                "label": "Home",
                "destination_type": "page",
                "page_id": home_id,
            },
            {
                "location": "header",
                "label": "Docs",
                "destination_type": "external_url",
                "external_url": "https://example.com/docs",
            },
        ],
    )
    assert _publish(client, portfolio_id).status_code == 200

    anonymous = client_factory()
    response = _public_site(anonymous, slug)
    assert response.status_code == 200
    # Browsers/proxies must never outlive the server-side cache window.
    assert response.headers["cache-control"] == "no-store"

    data = response.json()
    assert data["portfolio"]["slug"] == slug
    assert data["portfolio"]["status"] == "published"
    assert data["portfolio"]["published_at"] is not None

    home = next(page for page in data["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Published heading"

    assert data["theme"]["tokens"] != {}
    assert data["media"][0]["url"].startswith("/media/")
    assert data["media"][0]["url"].endswith("/file")

    # Navigation is complete enough for the renderer to build real links.
    assert len(data["navigation"]) == 2
    page_item = next(item for item in data["navigation"] if item["destination_type"] == "page")
    assert page_item["portfolio_id"] == portfolio_id
    assert page_item["page_id"] == home_id
    external = next(
        item for item in data["navigation"] if item["destination_type"] == "external_url"
    )
    assert external["external_url"] == "https://example.com/docs"

    # Page SEO fields ride along for per-page metadata.
    assert home["seo_title"] is None
    assert [page["slug"] for page in data["pages"] if page["is_homepage"]] == ["home"]


def test_draft_unknown_and_unpublished_sites_are_404(client: TestClient, client_factory) -> None:
    portfolio_id, slug = _setup_portfolio(client, name="Private Site")
    anonymous = client_factory()

    # A draft portfolio is indistinguishable from one that does not exist.
    draft = _public_site(anonymous, slug)
    assert draft.status_code == 404
    assert draft.json()["detail"] == _PRIVATE_DETAIL

    missing = _public_site(anonymous, unique_slug("ghost"))
    assert missing.status_code == 404
    assert missing.json()["detail"] == _PRIVATE_DETAIL

    assert _publish(client, portfolio_id).status_code == 200
    assert _public_site(anonymous, slug).status_code == 200

    # Unpublishing must flip the public URL back to 404 immediately — no
    # waiting out the cache TTL.
    assert _unpublish(client, portfolio_id).status_code == 200
    after = _public_site(anonymous, slug)
    assert after.status_code == 404
    assert after.json()["detail"] == _PRIVATE_DETAIL


def test_draft_edits_never_change_the_published_site(client: TestClient, client_factory) -> None:
    portfolio_id, slug = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    created = create_section(
        client, home_id, section_type="hero", content={"heading": "Published heading"}
    )
    section_id = created.json()["id"]
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
    assert _publish(client, portfolio_id).status_code == 200

    anonymous = client_factory()
    assert (
        _public_site(anonymous, slug).json()["pages"][0]["sections"][0]["content"]["heading"]
        == "Published heading"
    )

    # Draft edits (section content and navigation) must not leak publicly.
    assert update_section(client, section_id, content={"heading": "Draft edit"}).status_code == 200
    put_navigation(
        client,
        portfolio_id,
        items=[
            {
                "location": "header",
                "label": "Draft label",
                "destination_type": "page",
                "page_id": home_id,
            }
        ],
    )
    during_draft = _public_site(anonymous, slug)
    assert during_draft.status_code == 200
    home = next(page for page in during_draft.json()["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Published heading"
    assert during_draft.json()["navigation"][0]["label"] == "Home"

    # Republishing invalidates the cache, so the new snapshot is served at
    # once.
    republish = _publish(client, portfolio_id)
    assert republish.status_code == 200
    assert republish.json()["version_number"] == 2
    after = _public_site(anonymous, slug)
    home = next(page for page in after.json()["pages"] if page["is_homepage"])
    assert home["sections"][0]["content"]["heading"] == "Draft edit"
    assert after.json()["navigation"][0]["label"] == "Draft label"


def test_metadata_and_slug_changes_invalidate_the_public_cache(
    client: TestClient, client_factory
) -> None:
    portfolio_id, slug = _setup_portfolio(client, name="Before")
    assert _publish(client, portfolio_id).status_code == 200

    anonymous = client_factory()
    first = _public_site(anonymous, slug)
    assert first.status_code == 200
    assert first.json()["portfolio"]["name"] == "Before"

    # Portfolio metadata is served live for published sites, so a rename is
    # reflected on the next request instead of waiting for the cache TTL or a
    # republish.
    renamed = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"name": "After rename", "description": "New description"},
        headers=csrf_headers_for(client),
    )
    assert renamed.status_code == 200
    warmed = _public_site(anonymous, slug)
    assert warmed.status_code == 200
    assert warmed.json()["portfolio"]["name"] == "After rename"
    assert warmed.json()["portfolio"]["description"] == "New description"

    # A slug change moves the public URL: old path 404, new path serves.
    new_slug = unique_slug("renamed")
    changed = client.patch(
        f"/portfolios/{portfolio_id}",
        json={"slug": new_slug},
        headers=csrf_headers_for(client),
    )
    assert changed.status_code == 200
    assert _public_site(anonymous, slug).status_code == 404
    moved = _public_site(anonymous, new_slug)
    assert moved.status_code == 200
    assert moved.json()["portfolio"]["slug"] == new_slug


def test_deleting_a_published_portfolio_stops_serving_it(
    client: TestClient, client_factory
) -> None:
    portfolio_id, slug = _setup_portfolio(client)
    assert _publish(client, portfolio_id).status_code == 200

    anonymous = client_factory()
    assert _public_site(anonymous, slug).status_code == 200

    deleted = client.delete(f"/portfolios/{portfolio_id}", headers=csrf_headers_for(client))
    assert deleted.status_code == 204
    # The cached bundle must not outlive the portfolio.
    assert _public_site(anonymous, slug).status_code == 404


def test_corrupt_published_snapshot_serves_404(
    client: TestClient, db_session: Session, client_factory
) -> None:
    portfolio_id, slug = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    assert (
        create_section(
            client, home_id, section_type="hero", content={"heading": "Fine"}
        ).status_code
        == 201
    )
    assert _publish(client, portfolio_id).status_code == 200

    # Corrupt the stored snapshot directly, before the first public read.
    db_session.execute(
        update(PortfolioVersion)
        .where(PortfolioVersion.portfolio_id == uuid.UUID(portfolio_id))
        .values(snapshot_json={"portfolio": {"slug": slug}})
    )
    db_session.commit()

    anonymous = client_factory()
    response = _public_site(anonymous, slug)
    assert response.status_code == 404
    assert response.json()["detail"] == _PRIVATE_DETAIL


def test_sites_index_lists_only_valid_published_sites(
    client: TestClient, client_factory, db_session: Session
) -> None:
    published_id, published_slug = _setup_portfolio(client, name="Listed")
    home_id = _homepage_id(client, published_id)
    assert (
        create_section(
            client, home_id, section_type="hero", content={"heading": "Listed"}
        ).status_code
        == 201
    )

    # A second portfolio (same owner) stays draft and must never appear.
    draft_slug = unique_slug("draft")
    assert create_portfolio(client, name="Unlisted", slug=draft_slug).status_code == 201

    anonymous = client_factory()
    before = anonymous.get("/public/sites")
    assert before.status_code == 200
    listed_slugs = [site["slug"] for site in before.json()]
    assert draft_slug not in listed_slugs

    assert _publish(client, published_id).status_code == 200
    after = anonymous.get("/public/sites")
    assert after.status_code == 200
    entry = next(site for site in after.json() if site["slug"] == published_slug)
    assert entry["published_at"] is not None
    assert [page["slug"] for page in entry["pages"] if page["is_homepage"]] == ["home"]
    assert len(entry["pages"]) == 5

    # Unpublishing removes the site from discovery immediately.
    assert _unpublish(client, published_id).status_code == 200
    final = anonymous.get("/public/sites")
    assert published_slug not in [site["slug"] for site in final.json()]


def test_public_media_requires_a_published_portfolio(client: TestClient, client_factory) -> None:
    portfolio_id, _slug = _setup_portfolio(client)
    home_id = _homepage_id(client, portfolio_id)
    assert (
        create_section(
            client, home_id, section_type="hero", content={"heading": "Hero"}
        ).status_code
        == 201
    )
    uploaded = upload_media(client, portfolio_id, filename="hero.png", alt_text="Hero")
    assert uploaded.status_code == 201
    media_id = uploaded.json()["id"]
    url = f"/media/{media_id}/file"

    anonymous = client_factory()

    # Draft media is not even acknowledged to anonymous visitors.
    assert anonymous.get(url).status_code == 401
    # The owner keeps access to their own draft media.
    owned = client.get(url)
    assert owned.status_code == 200
    assert owned.content == png_bytes()

    # Publishing opens the asset to the public site.
    assert _publish(client, portfolio_id).status_code == 200
    public = anonymous.get(url)
    assert public.status_code == 200
    assert public.content == png_bytes()

    # ...and unpublishing closes it again on the next request.
    assert _unpublish(client, portfolio_id).status_code == 200
    assert anonymous.get(url).status_code == 401
