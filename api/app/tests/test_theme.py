"""Theme and global-layout API tests.

Coverage: option registry exposure, lazy default theme creation, token and
component validation (hex colors, allowlisted options, unknown groups/fields),
wholesale replacement semantics, global-layout isolation, per-portfolio
isolation, cross-user access, CSRF, and authentication.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.tests.support import (
    create_portfolio,
    get_global_layout,
    get_theme,
    get_theme_options,
    put_global_layout,
    put_theme,
    register,
    unique_slug,
)


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


# --- Options registry ------------------------------------------------------


def test_theme_options_requires_auth(client: TestClient) -> None:
    assert get_theme_options(client).status_code == 401


def test_theme_options_exposes_groups_and_defaults(client: TestClient) -> None:
    register(client)
    response = get_theme_options(client)
    assert response.status_code == 200

    data = response.json()
    assert data["schema_version"] == 1
    assert [group["name"] for group in data["token_groups"]] == [
        "colors",
        "typography",
        "spacing",
        "borders",
        "buttons",
        "cards",
        "links",
        "background",
    ]
    assert [group["name"] for group in data["layout_groups"]] == [
        "header",
        "footer",
        "sidebar",
        "branding",
        "social",
    ]
    assert data["default_tokens"]["colors"]["primary"] == "#4f46e5"
    assert data["default_components"]["header"]["visible"] is True

    colors = next(g for g in data["token_groups"] if g["name"] == "colors")
    primary = next(f for f in colors["fields"] if f["name"] == "primary")
    assert primary["kind"] == "color"


def test_theme_options_labels_controls_the_preview_cannot_show(client: TestClient) -> None:
    """Every control the editor preview cannot demonstrate carries ``help_text``.

    The design studio's rule (spec 9.x) is that a visible control must be
    persisted and previewed, or be clearly labelled. These settings only take
    effect on the published site (or in a state the static preview cannot
    reach), so they must be labelled rather than implied to work.
    """
    register(client)
    data = get_theme_options(client).json()

    layout = {
        group["name"]: {field["name"]: field for field in group["fields"]}
        for group in data["layout_groups"]
    }
    tokens = {
        group["name"]: {field["name"]: field for field in group["fields"]}
        for group in data["token_groups"]
    }

    for group_name, field_name in (
        ("header", "sticky"),
        ("header", "cta_url"),
        ("sidebar", "collapse_on_mobile"),
        ("branding", "favicon_url"),
    ):
        assert layout[group_name][field_name]["help_text"], (group_name, field_name)

    social_url = next(f for f in layout["social"]["links"]["fields"] if f["name"] == "url")
    assert social_url["help_text"]

    assert tokens["colors"]["link_hover"]["help_text"]
    assert tokens["colors"]["sidebar_background"]["help_text"]
    assert tokens["colors"]["sidebar_text"]["help_text"]

    # Previewable controls are not labelled as deferred.
    assert layout["header"]["layout"]["help_text"] is None
    assert tokens["colors"]["primary"]["help_text"] is None


# --- Defaults & reads ------------------------------------------------------


def test_theme_defaults_for_new_portfolio(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = get_theme(client, portfolio_id)
    assert response.status_code == 200
    data = response.json()
    assert data["portfolio_id"] == portfolio_id
    assert data["schema_version"] == 1
    assert data["tokens"]["colors"]["primary"] == "#4f46e5"
    assert data["components"]["header"]["visible"] is True


def test_get_theme_unauthenticated_is_401(client: TestClient) -> None:
    assert client.get(f"/portfolios/{uuid.uuid4()}/theme").status_code == 401


def test_get_theme_another_users_portfolio_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    assert get_theme(client_b, portfolio_id).status_code == 404


# --- Token updates ---------------------------------------------------------


def test_update_theme_tokens_persists(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_theme(
        client,
        portfolio_id,
        {"colors": {"primary": "#123456"}, "typography": {"heading_font": "serif"}},
    )
    assert response.status_code == 200
    tokens = response.json()["tokens"]
    assert tokens["colors"]["primary"] == "#123456"
    assert tokens["typography"]["heading_font"] == "serif"
    # Omitted groups and fields fall back to registry defaults.
    assert tokens["colors"]["text"] == "#0f172a"
    assert tokens["spacing"]["content_width"] == "default"

    fetched = get_theme(client, portfolio_id).json()
    assert fetched["tokens"]["colors"]["primary"] == "#123456"


def test_update_theme_normalizes_color_case(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_theme(client, portfolio_id, {"colors": {"primary": "#ABCDEF"}})
    assert response.status_code == 200
    assert response.json()["tokens"]["colors"]["primary"] == "#abcdef"


def test_update_theme_rejects_invalid_color(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    for bad in ["red", "#12", "#12345", "rgb(0,0,0)", "#gggggg"]:
        assert put_theme(client, portfolio_id, {"colors": {"primary": bad}}).status_code == 422, bad


def test_update_theme_rejects_invalid_font(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_theme(client, portfolio_id, {"typography": {"heading_font": "Comic Sans"}})
    assert response.status_code == 422


def test_update_theme_rejects_unknown_group(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    assert put_theme(client, portfolio_id, {"nope": {}}).status_code == 422


def test_update_theme_rejects_unknown_field(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_theme(client, portfolio_id, {"colors": {"not_a_color": "#000000"}})
    assert response.status_code == 422


def test_update_theme_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = client.put(
        f"/portfolios/{portfolio_id}/theme", json={"tokens": {"colors": {"primary": "#000000"}}}
    )
    assert response.status_code == 403


def test_update_theme_another_users_portfolio_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    response = put_theme(client_b, portfolio_id, {"colors": {"primary": "#000000"}})
    assert response.status_code == 404


# --- Global layout (components) --------------------------------------------


def test_global_layout_defaults_and_update(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    initial = get_global_layout(client, portfolio_id)
    assert initial.status_code == 200
    assert initial.json()["components"]["header"]["layout"] == "left"

    response = put_global_layout(
        client,
        portfolio_id,
        {"header": {"layout": "center", "sticky": True}, "sidebar": {"visible": True}},
    )
    assert response.status_code == 200
    components = response.json()["components"]
    assert components["header"]["layout"] == "center"
    assert components["header"]["sticky"] is True
    assert components["sidebar"]["visible"] is True

    # Tokens are unaffected by a global-layout write.
    theme = get_theme(client, portfolio_id).json()
    assert theme["components"]["header"]["layout"] == "center"
    assert theme["tokens"]["colors"]["primary"] == "#4f46e5"


def test_global_layout_social_repeater(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_global_layout(
        client,
        portfolio_id,
        {
            "social": {
                "links": [
                    {"platform": "github", "url": "https://github.com/example"},
                    {"platform": "website", "url": "https://example.com"},
                ]
            }
        },
    )
    assert response.status_code == 200
    links = response.json()["components"]["social"]["links"]
    assert [link["platform"] for link in links] == ["github", "website"]


def test_global_layout_rejects_invalid_option(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    assert (
        put_global_layout(client, portfolio_id, {"header": {"layout": "diagonal"}}).status_code
        == 422
    )


def test_global_layout_rejects_invalid_social_url(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = put_global_layout(
        client, portfolio_id, {"social": {"links": [{"platform": "website", "url": "nope"}]}}
    )
    assert response.status_code == 422


# --- Isolation -------------------------------------------------------------


def test_two_portfolios_have_independent_themes(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)

    put_theme(client, first, {"colors": {"primary": "#111111"}})

    assert get_theme(client, first).json()["tokens"]["colors"]["primary"] == "#111111"
    assert get_theme(client, second).json()["tokens"]["colors"]["primary"] == "#4f46e5"
