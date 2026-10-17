"""Small helpers shared by the API tests."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.core.config import get_settings

DEFAULT_PASSWORD = "correct horse battery"


def unique_email() -> str:
    """Return a unique email so tests never collide across runs."""
    return f"user-{uuid.uuid4().hex}@example.com"


def unique_slug(prefix: str = "portfolio") -> str:
    """Return a unique, valid slug so tests never collide across runs."""
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def register(
    client: TestClient,
    *,
    email: str | None = None,
    password: str = DEFAULT_PASSWORD,
    display_name: str = "Test User",
) -> tuple[str, object]:
    """Register a user through the API and return the response and email."""
    resolved_email = email or unique_email()
    response = client.post(
        "/auth/register",
        json={"email": resolved_email, "password": password, "display_name": display_name},
    )
    return resolved_email, response


def csrf_headers(client: TestClient, cookie_name: str) -> dict[str, str]:
    """Build the CSRF header from the client's current CSRF cookie."""
    token = client.cookies.get(cookie_name)
    assert token, "CSRF cookie was not set on the client."
    return {"X-CSRF-Token": token}


def csrf_headers_for(client: TestClient) -> dict[str, str]:
    """Build the CSRF header using the configured CSRF cookie name."""
    return csrf_headers(client, get_settings().csrf_cookie_name)


def create_portfolio(
    client: TestClient,
    *,
    name: str = "My Portfolio",
    slug: str | None = None,
    description: str | None = None,
):
    """Create a portfolio through the API using the client's CSRF token."""
    body: dict[str, object] = {"name": name}
    if slug is not None:
        body["slug"] = slug
    if description is not None:
        body["description"] = description
    return client.post("/portfolios", json=body, headers=csrf_headers_for(client))


def create_page(
    client: TestClient,
    portfolio_id: str,
    *,
    title: str = "My Page",
    slug: str | None = None,
    is_homepage: bool = False,
    is_visible: bool = True,
    seo_title: str | None = None,
    seo_description: str | None = None,
):
    """Create a page within a portfolio using the client's CSRF token."""
    body: dict[str, object] = {
        "title": title,
        "is_homepage": is_homepage,
        "is_visible": is_visible,
    }
    if slug is not None:
        body["slug"] = slug
    if seo_title is not None:
        body["seo_title"] = seo_title
    if seo_description is not None:
        body["seo_description"] = seo_description
    return client.post(
        f"/portfolios/{portfolio_id}/pages", json=body, headers=csrf_headers_for(client)
    )


def list_pages(client: TestClient, portfolio_id: str):
    """List a portfolio's pages."""
    return client.get(f"/portfolios/{portfolio_id}/pages")


def fetch_page(client: TestClient, page_id: str):
    """Retrieve a single page."""
    return client.get(f"/pages/{page_id}")


def update_page(client: TestClient, page_id: str, **changes: object):
    """Patch a page using the client's CSRF token."""
    return client.patch(f"/pages/{page_id}", json=changes, headers=csrf_headers_for(client))


def delete_page(client: TestClient, page_id: str):
    """Delete a page using the client's CSRF token."""
    return client.delete(f"/pages/{page_id}", headers=csrf_headers_for(client))


def reorder_pages(client: TestClient, portfolio_id: str, page_ids: list[str]):
    """Set the explicit page order using the client's CSRF token."""
    return client.put(
        f"/portfolios/{portfolio_id}/pages/order",
        json={"page_ids": page_ids},
        headers=csrf_headers_for(client),
    )


def get_navigation(client: TestClient, portfolio_id: str):
    """Fetch a portfolio's navigation items."""
    return client.get(f"/portfolios/{portfolio_id}/navigation")


def put_navigation(client: TestClient, portfolio_id: str, items: list[dict[str, object]]):
    """Replace a portfolio's navigation items using the client's CSRF token."""
    return client.put(
        f"/portfolios/{portfolio_id}/navigation",
        json={"items": items},
        headers=csrf_headers_for(client),
    )


def list_section_types(client: TestClient):
    """Fetch the supported section-type registry."""
    return client.get("/section-types")


def create_section(
    client: TestClient,
    page_id: str,
    *,
    section_type: str = "rich_text",
    name: str | None = None,
    is_visible: bool = True,
    content: dict[str, object] | None = None,
    layout: dict[str, object] | None = None,
):
    """Create a section on a page using the client's CSRF token."""
    body: dict[str, object] = {"section_type": section_type, "is_visible": is_visible}
    if name is not None:
        body["name"] = name
    if content is not None:
        body["content"] = content
    if layout is not None:
        body["layout"] = layout
    return client.post(f"/pages/{page_id}/sections", json=body, headers=csrf_headers_for(client))


def list_sections(client: TestClient, page_id: str):
    """List a page's sections."""
    return client.get(f"/pages/{page_id}/sections")


def fetch_section(client: TestClient, section_id: str):
    """Retrieve a single section."""
    return client.get(f"/sections/{section_id}")


def update_section(client: TestClient, section_id: str, **changes: object):
    """Patch a section using the client's CSRF token."""
    return client.patch(f"/sections/{section_id}", json=changes, headers=csrf_headers_for(client))


def delete_section(client: TestClient, section_id: str):
    """Delete a section using the client's CSRF token."""
    return client.delete(f"/sections/{section_id}", headers=csrf_headers_for(client))


def duplicate_section(client: TestClient, section_id: str):
    """Duplicate a section using the client's CSRF token."""
    return client.post(f"/sections/{section_id}/duplicate", headers=csrf_headers_for(client))


def reorder_sections(client: TestClient, page_id: str, section_ids: list[str]):
    """Set the explicit section order using the client's CSRF token."""
    return client.put(
        f"/pages/{page_id}/sections/order",
        json={"section_ids": section_ids},
        headers=csrf_headers_for(client),
    )
