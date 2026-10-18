"""End-to-end journey test (Phase 9, spec 19.5).

One test walks the entire documented product journey through the HTTP API —
create account → create portfolio → edit page/section/theme/layout/navigation →
save draft → preview → publish → open the public URL → confirm draft edits stay
private until republished → unpublish → public URL returns 404 — so the phases
compose into one working product, not just isolated feature suites.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.tests.support import (
    create_page,
    create_portfolio,
    create_section,
    csrf_headers_for,
    list_pages,
    put_global_layout,
    put_navigation,
    put_theme,
    register,
    unique_slug,
    update_page,
    update_section,
    upload_media,
)

_SECTION_BODY = "A body saved through the draft editor."


def _publish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/publish", headers=csrf_headers_for(client))


def _unpublish(client: TestClient, portfolio_id: str):
    return client.post(f"/portfolios/{portfolio_id}/unpublish", headers=csrf_headers_for(client))


def _public_site(anonymous: TestClient, slug: str):
    return anonymous.get(f"/public/portfolios/{slug}")


def _page_by_slug(site: dict, page_slug: str) -> dict:
    return next(page for page in site["pages"] if page["slug"] == page_slug)


def test_full_create_customize_preview_publish_journey(client: TestClient, client_factory) -> None:
    # --- Create account ---------------------------------------------------
    email, response = register(client, display_name="Journey User")
    assert response.status_code == 201
    assert response.json()["email"] == email

    # --- Create portfolio (seeded with starter pages, starts as draft) ----
    slug = unique_slug("journey")
    created = create_portfolio(
        client, name="Journey Portfolio", slug=slug, description="Built end to end"
    )
    assert created.status_code == 201, created.text
    portfolio_id = created.json()["id"]
    assert created.json()["status"] == "draft"
    assert created.json()["published_at"] is None

    # --- Customize pages --------------------------------------------------
    pages = list_pages(client, portfolio_id).json()
    homepage = next(page for page in pages if page["is_homepage"])
    assert (
        update_page(
            client,
            homepage["id"],
            seo_title="Journey Home",
            seo_description="The journey homepage",
        ).status_code
        == 200
    )
    about = create_page(
        client,
        portfolio_id,
        title="About the Journey",
        slug="about-journey",
        seo_title="About",
    )
    assert about.status_code == 201, about.text
    about_id = about.json()["id"]

    # --- Customize media and sections -------------------------------------
    uploaded = upload_media(client, portfolio_id, filename="portrait.png", alt_text="Portrait")
    assert uploaded.status_code == 201, uploaded.text
    media_id = uploaded.json()["id"]
    # The editor stores the absolute file URL the media picker produces (see
    # ``mediaFileUrl`` in the web client); the snapshot carries it verbatim
    # while the bundle's media index also lists the relative ``/media/{id}/file``.
    stored_image_url = f"http://localhost:8000/media/{media_id}/file"

    hero = create_section(
        client,
        homepage["id"],
        section_type="hero",
        content={"heading": "Journey heading", "body": "First draft body"},
    )
    assert hero.status_code == 201, hero.text
    hero_id = hero.json()["id"]
    assert (
        update_section(
            client, hero_id, content={"heading": "Journey heading", "body": _SECTION_BODY}
        ).status_code
        == 200
    )

    about_section = create_section(
        client,
        about_id,
        section_type="image_text",
        content={
            "heading": "About heading",
            "body": "About body",
            "image_url": stored_image_url,
            "image_alt": "Portrait",
        },
    )
    assert about_section.status_code == 201, about_section.text

    # --- Customize theme, global layout, and navigation -------------------
    themed = put_theme(client, portfolio_id, tokens={"colors": {"primary": "#112233"}})
    assert themed.status_code == 200, themed.text
    laid_out = put_global_layout(client, portfolio_id, components={"header": {"layout": "center"}})
    assert laid_out.status_code == 200, laid_out.text
    navigation = put_navigation(
        client,
        portfolio_id,
        items=[
            {
                "location": "header",
                "label": "Home",
                "destination_type": "page",
                "page_id": homepage["id"],
            },
            {
                "location": "header",
                "label": "About",
                "destination_type": "page",
                "page_id": about_id,
            },
        ],
    )
    assert navigation.status_code == 200, navigation.text

    # --- Preview reflects the draft ---------------------------------------
    preview = client.get(f"/portfolios/{portfolio_id}/preview")
    assert preview.status_code == 200, preview.text
    preview_data = preview.json()
    assert preview_data["portfolio"]["status"] == "draft"
    preview_home = _page_by_slug(preview_data, "home")
    assert preview_home["sections"][0]["content"]["body"] == _SECTION_BODY
    assert preview_data["theme"]["tokens"]["colors"]["primary"] == "#112233"
    assert preview_data["theme"]["components"]["header"]["layout"] == "center"
    assert [item["label"] for item in preview_data["navigation"]] == ["Home", "About"]

    # --- Publish ----------------------------------------------------------
    published = _publish(client, portfolio_id)
    assert published.status_code == 200, published.text
    result = published.json()
    assert result["status"] == "published"
    assert result["version_number"] == 1
    assert result["public_path"] == f"/p/{slug}"

    # --- Open the public URL as an anonymous visitor ----------------------
    anonymous = client_factory()
    site = _public_site(anonymous, slug)
    assert site.status_code == 200, site.text
    site_data = site.json()
    assert site_data["portfolio"]["status"] == "published"
    public_home = _page_by_slug(site_data, "home")
    assert public_home["seo_title"] == "Journey Home"
    assert public_home["sections"][0]["content"]["body"] == _SECTION_BODY
    assert site_data["theme"]["tokens"]["colors"]["primary"] == "#112233"
    assert site_data["theme"]["components"]["header"]["layout"] == "center"
    assert {item["label"] for item in site_data["navigation"]} == {"Home", "About"}
    assert any(asset["url"] == f"/media/{media_id}/file" for asset in site_data["media"])

    about_public = _page_by_slug(site_data, "about-journey")
    assert about_public["sections"][0]["content"]["image_url"] == stored_image_url
    assert about_public["sections"][0]["content"]["image_alt"] == "Portrait"

    # The uploaded image is publicly readable only because its portfolio is
    # published.
    media_bytes = anonymous.get(f"/media/{media_id}/file")
    assert media_bytes.status_code == 200

    # --- Draft edits stay private until the next publish ------------------
    assert (
        update_section(
            client, hero_id, content={"heading": "Journey heading", "body": "Second draft body"}
        ).status_code
        == 200
    )
    during_draft = _public_site(anonymous, slug)
    draft_home = _page_by_slug(during_draft.json(), "home")
    assert draft_home["sections"][0]["content"]["body"] == _SECTION_BODY
    second_preview = client.get(f"/portfolios/{portfolio_id}/preview")
    assert (
        _page_by_slug(second_preview.json(), "home")["sections"][0]["content"]["body"]
        == "Second draft body"
    )

    republished = _publish(client, portfolio_id)
    assert republished.status_code == 200, republished.text
    assert republished.json()["version_number"] == 2
    after = _public_site(anonymous, slug)
    updated_home = _page_by_slug(after.json(), "home")
    assert updated_home["sections"][0]["content"]["body"] == "Second draft body"

    # --- Unpublish hides the site again -----------------------------------
    assert _unpublish(client, portfolio_id).status_code == 200
    assert _public_site(anonymous, slug).status_code == 404
    # Draft media closes to anonymous visitors again once unpublished.
    assert anonymous.get(f"/media/{media_id}/file").status_code == 401
