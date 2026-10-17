"""Section API tests.

Coverage: section-type registry exposure, section CRUD, registry-driven content
validation (defaults, unknown types/keys, field kinds, URL and repeater limits),
explicit ordering, duplication, page-portfolio cross-user isolation, CSRF, and
database cascade behavior.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.page import Page
from app.models.page_section import PageSection
from app.tests.support import (
    create_page,
    create_portfolio,
    create_section,
    delete_page,
    delete_section,
    duplicate_section,
    fetch_section,
    list_section_types,
    list_sections,
    register,
    reorder_sections,
    unique_slug,
    update_section,
)


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def _page_id(client: TestClient, portfolio_id: str, title: str = "Content") -> str:
    response = create_page(client, portfolio_id, title=title, slug=unique_slug("page"))
    assert response.status_code == 201, response.text
    return response.json()["id"]


# --- Section type registry -------------------------------------------------


def test_list_section_types_requires_auth(client: TestClient) -> None:
    assert list_section_types(client).status_code == 401


def test_list_section_types_exposes_registry(client: TestClient) -> None:
    register(client)
    response = list_section_types(client)
    assert response.status_code == 200
    types = {entry["type_id"]: entry for entry in response.json()}

    assert "hero" in types
    assert "divider" in types

    hero = types["hero"]
    assert hero["group"] == "Essentials"
    assert hero["schema_version"] == 1
    assert hero["default_content"]["heading"] == ""
    assert hero["default_content"]["show_availability"] is False
    assert hero["default_content"]["buttons"] == []
    assert hero["default_layout"] == {"alignment": "left"}

    heading = next(f for f in hero["content_fields"] if f["name"] == "heading")
    assert heading["required"] is True
    assert heading["kind"] == "text"
    assert heading["max_length"] == 500

    buttons = next(f for f in hero["content_fields"] if f["name"] == "buttons")
    assert buttons["kind"] == "repeater"
    assert buttons["max_items"] == 2
    assert {child["name"] for child in buttons["fields"]} == {"label", "url"}


# --- Create ----------------------------------------------------------------


def test_create_section_appends_with_registry_defaults(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    first = create_section(client, page_id, section_type="rich_text")
    assert first.status_code == 201, first.text
    data = first.json()
    assert data["page_id"] == page_id
    assert data["section_type"] == "rich_text"
    assert data["name"] == "Rich text"
    assert data["sort_order"] == 0
    assert data["is_visible"] is True
    assert data["schema_version"] == 1
    assert data["content"] == {"heading": "", "body": ""}
    assert data["layout"] == {"alignment": "left"}

    second = create_section(client, page_id, section_type="divider", name="Spacer")
    assert second.status_code == 201
    assert second.json()["sort_order"] == 1
    assert second.json()["name"] == "Spacer"
    assert second.json()["content"] == {}


def test_create_section_accepts_and_stores_content(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = create_section(
        client,
        page_id,
        section_type="hero",
        content={
            "heading": "  Hello  ",
            "show_availability": True,
            "buttons": [{"label": "Hire me", "url": "https://example.com/contact"}],
        },
        layout={"alignment": "center"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["content"]["heading"] == "Hello"  # trimmed
    assert data["content"]["subheading"] == ""  # omitted -> default
    assert data["content"]["show_availability"] is True
    assert data["content"]["buttons"] == [
        {"label": "Hire me", "url": "https://example.com/contact"}
    ]
    assert data["layout"] == {"alignment": "center"}


def test_create_section_unknown_type_is_422(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = create_section(client, page_id, section_type="not-a-type")
    assert response.status_code == 422


def test_create_section_unknown_content_key_is_422(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = create_section(
        client, page_id, section_type="rich_text", content={"heading": "Hi", "bogus": 1}
    )
    assert response.status_code == 422


def test_create_section_rejects_blank_required_field(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = create_section(client, page_id, section_type="hero", content={"heading": "   "})
    assert response.status_code == 422


def test_create_section_rejects_wrong_kind(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    assert (
        create_section(client, page_id, section_type="hero", content={"heading": 5}).status_code
        == 422
    )
    assert (
        create_section(
            client, page_id, section_type="divider", layout={"style": "dashed"}
        ).status_code
        == 422
    )


def test_create_section_rejects_invalid_url(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    for bad in ["javascript:alert(1)", "not a url", "ftp://example.com"]:
        response = create_section(
            client,
            page_id,
            section_type="link_list",
            content={"links": [{"label": "x", "url": bad}]},
        )
        assert response.status_code == 422, bad


def test_create_section_rejects_excess_repeater_items(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    metrics = [{"value": str(i), "label": f"m{i}"} for i in range(13)]  # max is 12
    response = create_section(client, page_id, section_type="metrics", content={"metrics": metrics})
    assert response.status_code == 422


def test_create_section_unauthenticated_is_401(client: TestClient) -> None:
    response = client.post(f"/pages/{uuid.uuid4()}/sections", json={"section_type": "divider"})
    assert response.status_code == 401


def test_create_section_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = client.post(f"/pages/{page_id}/sections", json={"section_type": "divider"})
    assert response.status_code == 403


# --- Read / list -----------------------------------------------------------


def test_list_sections_empty_for_new_page(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    response = list_sections(client, page_id)
    assert response.status_code == 200
    assert response.json() == []


def test_list_sections_returns_creation_order(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    ids = [
        create_section(client, page_id, section_type="divider").json()["id"],
        create_section(client, page_id, section_type="rich_text").json()["id"],
        create_section(client, page_id, section_type="metrics").json()["id"],
    ]
    response = list_sections(client, page_id)
    assert [section["id"] for section in response.json()] == ids


def test_read_own_section_returns_200(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    response = fetch_section(client, section_id)
    assert response.status_code == 200
    assert response.json()["id"] == section_id


# --- Update ----------------------------------------------------------------


def test_update_section_changes_fields(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id, section_type="hero").json()["id"]

    response = update_section(
        client,
        section_id,
        name="My Hero",
        is_visible=False,
        content={"heading": "Welcome"},
        layout={"alignment": "right"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["name"] == "My Hero"
    assert data["is_visible"] is False
    assert data["content"]["heading"] == "Welcome"
    assert data["layout"]["alignment"] == "right"


def test_update_section_invalid_content_is_422(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id, section_type="hero").json()["id"]

    response = update_section(client, section_id, content={"bogus": True})
    assert response.status_code == 422


def test_update_section_rejects_null_name(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    assert update_section(client, section_id, name=None).status_code == 422


def test_update_section_without_changes_is_no_op(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id, name="Keep").json()["id"]

    response = update_section(client, section_id)
    assert response.status_code == 200
    assert response.json()["name"] == "Keep"


def test_update_section_type_is_immutable(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id, section_type="divider").json()["id"]

    response = update_section(client, section_id, section_type="hero", name="Still divider")
    assert response.status_code == 200
    assert response.json()["section_type"] == "divider"


def test_update_section_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    response = client.patch(f"/sections/{section_id}", json={"name": "Nope"})
    assert response.status_code == 403


# --- Duplicate / delete ----------------------------------------------------


def test_duplicate_section_copies_after_original(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    first = create_section(client, page_id, section_type="hero", name="Intro").json()["id"]
    second = create_section(client, page_id, section_type="divider").json()["id"]

    response = duplicate_section(client, first)
    assert response.status_code == 201, response.text
    copy = response.json()
    assert copy["id"] != first
    assert copy["name"] == "Intro copy"
    assert copy["section_type"] == "hero"

    ordered = [section["id"] for section in list_sections(client, page_id).json()]
    assert ordered == [first, copy["id"], second]
    assert [section["sort_order"] for section in list_sections(client, page_id).json()] == [0, 1, 2]


def test_duplicate_section_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    assert client.post(f"/sections/{section_id}/duplicate").status_code == 403


def test_delete_section_returns_204_and_is_gone(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    assert delete_section(client, section_id).status_code == 204
    assert fetch_section(client, section_id).status_code == 404


def test_delete_section_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    section_id = create_section(client, page_id).json()["id"]

    assert client.delete(f"/sections/{section_id}").status_code == 403


# --- Reorder ---------------------------------------------------------------


def test_reorder_sections_updates_order(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)

    ids = [create_section(client, page_id, section_type="metrics").json()["id"] for _ in range(3)]
    reversed_ids = list(reversed(ids))

    response = reorder_sections(client, page_id, reversed_ids)
    assert response.status_code == 200, response.text
    assert [section["id"] for section in response.json()] == reversed_ids
    assert [section["sort_order"] for section in response.json()] == [0, 1, 2]
    assert [section["id"] for section in list_sections(client, page_id).json()] == reversed_ids


def test_reorder_sections_requires_full_permutation(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    ids = [create_section(client, page_id, section_type="metrics").json()["id"] for _ in range(2)]

    assert reorder_sections(client, page_id, ids[:-1]).status_code == 422
    assert reorder_sections(client, page_id, ids[:-1] + [ids[0]]).status_code == 422
    assert reorder_sections(client, page_id, ids + [str(uuid.uuid4())]).status_code == 422


def test_reorder_sections_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    ids = [create_section(client, page_id).json()["id"]]

    response = client.put(f"/pages/{page_id}/sections/order", json={"section_ids": ids})
    assert response.status_code == 403


# --- Ownership isolation ---------------------------------------------------


def test_section_operations_isolated_between_users(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a, display_name="A")
    register(client_b, display_name="B")

    portfolio_id = _create_portfolio(client_a)
    page_id = _page_id(client_a, portfolio_id)
    section_id = create_section(client_a, page_id).json()["id"]

    assert list_sections(client_b, page_id).status_code == 404
    assert create_section(client_b, page_id).status_code == 404
    assert reorder_sections(client_b, page_id, [section_id]).status_code == 404
    assert fetch_section(client_b, section_id).status_code == 404
    assert update_section(client_b, section_id, name="Hacked").status_code == 404
    assert delete_section(client_b, section_id).status_code == 404
    assert duplicate_section(client_b, section_id).status_code == 404


def test_sections_scoped_to_their_page_for_same_user(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_a = _page_id(client, portfolio_id, title="Page A")
    page_b = _page_id(client, portfolio_id, title="Page B")

    create_section(client, page_a, section_type="hero")
    only_b = create_section(client, page_b, section_type="divider").json()["id"]

    assert [section["id"] for section in list_sections(client, page_a).json()] != [only_b]
    assert [section["id"] for section in list_sections(client, page_b).json()] == [only_b]

    # Reordering page A with page B's ids is rejected as a non-permutation.
    assert reorder_sections(client, page_a, [only_b]).status_code == 422


# --- Database behavior -----------------------------------------------------


def test_deleting_page_cascades_sections(db_session: Session, client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    create_section(client, page_id, section_type="hero")
    create_section(client, page_id, section_type="divider")

    assert delete_page(client, page_id).status_code == 204

    db_session.expire_all()
    remaining = db_session.scalar(
        select(func.count())
        .select_from(PageSection)
        .where(PageSection.page_id == uuid.UUID(page_id))
    )
    assert remaining == 0
    assert db_session.scalar(select(func.count()).select_from(Page)) is not None


def test_sections_scope_to_their_page_in_db(db_session: Session, client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page_id = _page_id(client, portfolio_id)
    create_section(client, page_id)

    sections = list(
        db_session.scalars(select(PageSection).where(PageSection.page_id == uuid.UUID(page_id)))
    )
    assert len(sections) == 1
    assert sections[0].content_json == {"heading": "", "body": ""}
