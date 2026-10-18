"""Section-level style override tests.

Sections inherit the portfolio theme and may store curated local overrides
(background, text color, spacing, width, radius, shadow, border). Coverage:
registry exposure of the shared style fields, default inheritance, validated
overrides, rejection of unknown fields and bad colors, and propagation through
update/duplicate.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.tests.support import (
    create_page,
    create_portfolio,
    create_section,
    duplicate_section,
    fetch_section,
    list_section_types,
    register,
    unique_slug,
    update_section,
)

_DEFAULT_STYLE = {
    "background": "inherit",
    "background_color": "",
    "text_color": "",
    "spacing": "inherit",
    "width": "inherit",
    "radius": "inherit",
    "shadow": "inherit",
    "border": "inherit",
    "responsive_override": {"desktop": None, "tablet": None, "mobile": None},
}


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def _page_id(client: TestClient, portfolio_id: str) -> str:
    response = create_page(client, portfolio_id, title="Content", slug=unique_slug("page"))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_section_types_expose_style_fields(client: TestClient) -> None:
    register(client)
    types = {entry["type_id"]: entry for entry in list_section_types(client).json()}

    hero = types["hero"]
    assert hero["default_style"] == _DEFAULT_STYLE
    names = [field["name"] for field in hero["style_fields"]]
    assert names[0] == "background"
    assert "background_color" in names


def test_create_section_defaults_to_inherited_style(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(client, page_id, section_type="hero")
    assert response.status_code == 201
    assert response.json()["style"] == _DEFAULT_STYLE


def test_create_section_with_style_overrides(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"background": "custom", "background_color": "#ABC", "spacing": "large"},
    )
    assert response.status_code == 201
    style = response.json()["style"]
    assert style["background"] == "custom"
    assert style["background_color"] == "#abc"
    assert style["spacing"] == "large"
    assert style["radius"] == "inherit"


def test_create_section_rejects_invalid_style_color(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(client, page_id, section_type="hero", style={"text_color": "blue"})
    assert response.status_code == 422


def test_create_section_rejects_unknown_style_field(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client, page_id, section_type="hero", style={"border_radius": "large"}
    )
    assert response.status_code == 422


def test_update_section_style(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))
    section_id = create_section(client, page_id, section_type="hero").json()["id"]

    response = update_section(client, section_id, style={"shadow": "large", "border": "thick"})
    assert response.status_code == 200
    assert response.json()["style"]["shadow"] == "large"
    assert response.json()["style"]["border"] == "thick"

    fetched = fetch_section(client, section_id).json()
    assert fetched["style"]["shadow"] == "large"


def test_update_section_rejects_invalid_style(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))
    section_id = create_section(client, page_id, section_type="hero").json()["id"]

    response = update_section(client, section_id, style={"width": "gigantic"})
    assert response.status_code == 422


def test_create_section_with_responsive_override(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"responsive_override": {"mobile": {"spacing": "large"}}},
    )
    assert response.status_code == 201, response.text
    override = response.json()["style"]["responsive_override"]
    assert override["mobile"] == {"spacing": "large"}
    assert override["desktop"] is None
    assert override["tablet"] is None

    fetched = fetch_section(client, response.json()["id"]).json()
    assert fetched["style"]["responsive_override"]["mobile"] == {"spacing": "large"}


def test_update_section_responsive_override(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))
    section_id = create_section(client, page_id, section_type="hero").json()["id"]

    response = update_section(
        client,
        section_id,
        style={"responsive_override": {"tablet": {"radius": "pill", "width": "narrow"}}},
    )
    assert response.status_code == 200
    assert response.json()["style"]["responsive_override"]["tablet"] == {
        "radius": "pill",
        "width": "narrow",
    }

    fetched = fetch_section(client, section_id).json()
    assert fetched["style"]["responsive_override"]["tablet"]["radius"] == "pill"


def test_default_style_round_trips_with_responsive_override(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(client, page_id, section_type="hero", style=_DEFAULT_STYLE)

    assert response.status_code == 201, response.text
    assert response.json()["style"] == _DEFAULT_STYLE


def test_responsive_override_rejects_unknown_breakpoint(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"responsive_override": {"widescreen": {"spacing": "large"}}},
    )

    assert response.status_code == 422


def test_responsive_override_rejects_unknown_field(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"responsive_override": {"mobile": {"columns": "3"}}},
    )

    assert response.status_code == 422


def test_responsive_override_rejects_invalid_style_value(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"responsive_override": {"desktop": {"spacing": "gigantic"}}},
    )

    assert response.status_code == 422


def test_responsive_override_accepts_null_to_inherit(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))

    response = create_section(
        client,
        page_id,
        section_type="hero",
        style={"responsive_override": {"mobile": None, "desktop": None, "tablet": None}},
    )

    assert response.status_code == 201, response.text
    assert response.json()["style"]["responsive_override"] == {
        "desktop": None,
        "tablet": None,
        "mobile": None,
    }


def test_duplicate_section_copies_style(client: TestClient) -> None:
    register(client)
    page_id = _page_id(client, _create_portfolio(client))
    section_id = create_section(
        client, page_id, section_type="hero", style={"background": "surface", "radius": "pill"}
    ).json()["id"]

    duplicate = duplicate_section(client, section_id)
    assert duplicate.status_code == 201
    assert duplicate.json()["style"]["background"] == "surface"
    assert duplicate.json()["style"]["radius"] == "pill"
