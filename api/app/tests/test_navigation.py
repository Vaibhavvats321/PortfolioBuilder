"""Navigation API tests.

Navigation is read and replaced as a whole ordered list. Coverage: empty state,
create/edit/delete/reorder via replace, destination validation (page ownership,
external URL scheme, structural consistency), location/label validation, the
200-item cap, cascade cleanup when a referenced page is deleted, cross-user
isolation, CSRF, and authentication.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.tests.support import (
    create_page,
    create_portfolio,
    delete_page,
    get_navigation,
    list_pages,
    put_navigation,
    register,
    unique_slug,
)


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def _page_ids(client: TestClient, portfolio_id: str) -> dict[str, str]:
    return {page["slug"]: page["id"] for page in list_pages(client, portfolio_id).json()}


def _page_item(page_id: str, *, label: str = "Link", location: str = "header") -> dict:
    return {
        "location": location,
        "label": label,
        "destination_type": "page",
        "page_id": page_id,
    }


def _external_item(url: str, *, label: str = "Ext", location: str = "footer") -> dict:
    return {
        "location": location,
        "label": label,
        "destination_type": "external_url",
        "external_url": url,
    }


def test_navigation_is_empty_for_new_portfolio(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = get_navigation(client, portfolio_id)
    assert response.status_code == 200
    assert response.json() == []


def test_get_navigation_unauthenticated_is_401(client: TestClient) -> None:
    response = client.get(f"/portfolios/{uuid.uuid4()}/navigation")
    assert response.status_code == 401


def test_get_navigation_another_users_portfolio_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    assert get_navigation(client_b, portfolio_id).status_code == 404


def test_replace_navigation_creates_ordered_items(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    items = [
        _page_item(pages["home"], label="Home", location="header"),
        _page_item(pages["about"], label="About", location="header"),
        _external_item("https://example.com", label="Blog", location="footer"),
    ]
    response = put_navigation(client, portfolio_id, items)
    assert response.status_code == 200

    data = response.json()
    assert [item["label"] for item in data] == ["Home", "About", "Blog"]
    assert [item["sort_order"] for item in data] == [0, 1, 2]
    assert data[2]["destination_type"] == "external_url"
    assert data[2]["external_url"] == "https://example.com"

    # Persisted and ordered on a subsequent read.
    fetched = get_navigation(client, portfolio_id).json()
    assert [item["label"] for item in fetched] == ["Home", "About", "Blog"]


def test_replace_navigation_edits_deletes_and_reorders(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    first = put_navigation(
        client,
        portfolio_id,
        [
            _page_item(pages["home"], label="Home"),
            _page_item(pages["about"], label="About"),
            _page_item(pages["work"], label="Work"),
        ],
    )
    assert first.status_code == 200

    # Drop "About", edit "Work" label, and put "Home" last.
    second = put_navigation(
        client,
        portfolio_id,
        [
            _page_item(pages["work"], label="Portfolio"),
            _page_item(pages["home"], label="Start"),
        ],
    )
    assert second.status_code == 200
    data = second.json()
    assert [item["label"] for item in data] == ["Portfolio", "Start"]
    assert [item["destination_type"] for item in data] == ["page", "page"]


def test_replace_navigation_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    response = client.put(
        f"/portfolios/{portfolio_id}/navigation",
        json={"items": [_page_item(pages["home"])]},
    )
    assert response.status_code == 403


def test_replace_navigation_another_users_portfolio_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    pages = _page_ids(client_a, portfolio_id)

    response = put_navigation(client_b, portfolio_id, [_page_item(pages["home"])])
    assert response.status_code == 404


def test_replace_navigation_rejects_page_from_another_portfolio(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)
    other_page_id = _page_ids(client, second)["about"]

    response = put_navigation(client, first, [_page_item(other_page_id)])
    assert response.status_code == 422


def test_replace_navigation_rejects_unknown_page(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_navigation(client, portfolio_id, [_page_item(str(uuid.uuid4()))])
    assert response.status_code == 422


def test_replace_navigation_rejects_invalid_external_url(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    for bad_url in ["javascript:alert(1)", "ftp://example.com", "example.com", "   "]:
        response = put_navigation(client, portfolio_id, [_external_item(bad_url)])
        assert response.status_code == 422, bad_url


def test_replace_navigation_rejects_inconsistent_destination(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    # Page destination without a page_id.
    page_without_id = {"location": "header", "label": "X", "destination_type": "page"}
    # Page destination that also carries an external_url.
    page_with_url = {
        "location": "header",
        "label": "X",
        "destination_type": "page",
        "page_id": pages["home"],
        "external_url": "https://example.com",
    }
    # External destination without a URL.
    external_without_url = {"location": "footer", "label": "X", "destination_type": "external_url"}
    # External destination that also carries a page_id.
    external_with_page = {
        "location": "footer",
        "label": "X",
        "destination_type": "external_url",
        "external_url": "https://example.com",
        "page_id": pages["home"],
    }

    for item in [page_without_id, page_with_url, external_without_url, external_with_page]:
        assert put_navigation(client, portfolio_id, [item]).status_code == 422, item


def test_replace_navigation_rejects_invalid_location_and_label(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    bad_location = _page_item(pages["home"], location="top")
    blank_label = _page_item(pages["home"], label="   ")

    assert put_navigation(client, portfolio_id, [bad_location]).status_code == 422
    assert put_navigation(client, portfolio_id, [blank_label]).status_code == 422


def test_replace_navigation_rejects_too_many_items(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    items = [_external_item(f"https://example.com/{i}") for i in range(201)]
    assert put_navigation(client, portfolio_id, items).status_code == 422


def test_deleting_page_cascades_navigation_items(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    created = put_navigation(
        client,
        portfolio_id,
        [
            _page_item(pages["home"], label="Home"),
            _page_item(pages["about"], label="About"),
        ],
    )
    assert created.status_code == 200

    assert delete_page(client, pages["about"]).status_code == 204

    remaining = get_navigation(client, portfolio_id).json()
    assert [item["label"] for item in remaining] == ["Home"]


def test_replace_navigation_can_clear_items(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    pages = _page_ids(client, portfolio_id)

    assert put_navigation(client, portfolio_id, [_page_item(pages["home"])]).status_code == 200
    assert put_navigation(client, portfolio_id, []).status_code == 200
    assert get_navigation(client, portfolio_id).json() == []


def test_replace_navigation_scoped_to_portfolio(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)
    first_pages = _page_ids(client, first)

    create_page(client, second, title="Second Gallery", slug="second-gallery")

    put_navigation(client, first, [_page_item(first_pages["home"], label="Home")])

    assert [item["label"] for item in get_navigation(client, first).json()] == ["Home"]
    assert get_navigation(client, second).json() == []
