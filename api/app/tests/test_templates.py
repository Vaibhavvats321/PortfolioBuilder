"""Design template API tests.

Coverage: listing templates (auth), applying a template (replaces design,
leaves pages/sections untouched), unknown template, CSRF, cross-user access,
per-portfolio isolation, and a guarantee that every shipped template validates
against the registry (so applying one can never fail validation).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.sections.fields import SectionValidationError
from app.tests.support import (
    apply_template,
    create_page,
    create_portfolio,
    create_section,
    get_theme,
    list_sections,
    list_templates,
    register,
    unique_slug,
)
from app.theme.registry import (
    default_components,
    default_tokens,
    validate_components,
    validate_tokens,
)
from app.theme.templates import list_templates as list_template_definitions


def _create_portfolio(client: TestClient) -> str:
    response = create_portfolio(client, name="Site", slug=unique_slug("site"))
    assert response.status_code == 201
    return response.json()["id"]


def test_list_templates_requires_auth(client: TestClient) -> None:
    assert list_templates(client).status_code == 401


def test_list_templates_returns_definitions(client: TestClient) -> None:
    register(client)
    response = list_templates(client)
    assert response.status_code == 200

    templates = {template["id"]: template for template in response.json()}
    assert "minimal-mono" in templates
    assert "modern-indigo" in templates
    assert "editorial-serif" in templates
    assert templates["modern-indigo"]["tokens"]["colors"]["primary"] == "#4f46e5"


def test_every_template_matches_the_registry() -> None:
    """A shipped template must always be a valid theme document."""
    for definition in list_template_definitions():
        assert validate_tokens(definition.tokens) == definition.tokens, definition.id
        assert validate_components(definition.components) == definition.components, definition.id


def test_templates_are_distinct_from_defaults() -> None:
    templates = list_template_definitions()
    assert len({template.id for template in templates}) == len(templates)
    assert len({template.name for template in templates}) == len(templates)
    # At least one template differs from the raw registry defaults.
    assert any(
        template.tokens != default_tokens() or template.components != default_components()
        for template in templates
    )


def test_apply_template_replaces_design(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = apply_template(client, portfolio_id, "modern-indigo")
    assert response.status_code == 200
    data = response.json()
    assert data["tokens"]["colors"]["primary"] == "#4f46e5"
    assert data["components"]["header"]["sticky"] is True

    fetched = get_theme(client, portfolio_id).json()
    assert fetched["tokens"]["colors"]["surface"] == "#eef2ff"


def test_apply_template_does_not_touch_content(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    page = create_page(client, portfolio_id, title="About", slug=unique_slug("about")).json()
    section = create_section(client, page["id"], section_type="hero", content={"heading": "Hi"})
    assert section.status_code == 201

    assert apply_template(client, portfolio_id, "editorial-serif").status_code == 200

    sections = list_sections(client, page["id"]).json()
    assert len(sections) == 1
    assert sections[0]["content"]["heading"] == "Hi"


def test_apply_unknown_template_is_404(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    assert apply_template(client, portfolio_id, "does-not-exist").status_code == 404


def test_apply_template_without_csrf_is_403(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)

    response = client.post(f"/portfolios/{portfolio_id}/templates/modern-indigo/apply")
    assert response.status_code == 403


def test_apply_template_another_users_portfolio_is_404(client_factory) -> None:
    client_a = client_factory()
    client_b = client_factory()
    register(client_a)
    register(client_b)

    portfolio_id = _create_portfolio(client_a)
    assert apply_template(client_b, portfolio_id, "modern-indigo").status_code == 404


def test_apply_template_isolated_between_portfolios(client: TestClient) -> None:
    register(client)
    first = _create_portfolio(client)
    second = _create_portfolio(client)

    apply_template(client, first, "minimal-mono")

    assert get_theme(client, first).json()["tokens"]["colors"]["primary"] == "#111827"
    assert get_theme(client, second).json()["tokens"]["colors"]["primary"] == "#4f46e5"


def test_invalid_template_definition_is_rejected() -> None:
    """The registry validator is the gate that keeps templates safe to apply."""
    try:
        validate_tokens({"colors": {"primary": "not-a-color"}})
    except SectionValidationError:
        return
    raise AssertionError("Expected an invalid template token to be rejected.")


def test_apply_template_requires_existing_template_id_shape(client: TestClient) -> None:
    register(client)
    portfolio_id = _create_portfolio(client)
    # An arbitrary id is unknown, never a 500.
    assert apply_template(client, portfolio_id, str(uuid.uuid4())).status_code == 404
