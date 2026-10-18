"""Starter design templates.

A template is code (engine configuration), not data entered by a user. It
defines a complete, valid theme (tokens plus component/global-layout options)
that a portfolio can adopt. Applying a template is an explicit, validated
action: it replaces only the portfolio's design and never touches its pages,
sections, or navigation.

Each template is built from the registry defaults so every value is guaranteed
to be a permitted option, and the definitions are re-validated against the
registry before they are stored.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.theme.registry import default_components, default_tokens

# Per-group field overrides layered on top of the registry defaults.
GroupOverrides = dict[str, dict[str, Any]]


@dataclass(frozen=True)
class TemplateDefinition:
    """A named starter theme that a portfolio can apply."""

    id: str
    name: str
    description: str
    tokens: dict[str, Any] = field(default_factory=dict)
    components: dict[str, Any] = field(default_factory=dict)


def _build(
    token_overrides: GroupOverrides | None = None,
    component_overrides: GroupOverrides | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    tokens = default_tokens()
    for group, values in (token_overrides or {}).items():
        tokens[group].update(values)
    components = default_components()
    for group, values in (component_overrides or {}).items():
        components[group].update(values)
    return tokens, components


_MINIMAL_TOKENS, _MINIMAL_COMPONENTS = _build(
    token_overrides={
        "colors": {
            "primary": "#111827",
            "secondary": "#374151",
            "accent": "#111827",
            "page_background": "#ffffff",
            "surface": "#f9fafb",
            "text": "#111827",
            "muted_text": "#6b7280",
            "border": "#e5e7eb",
            "link": "#111827",
            "link_hover": "#000000",
            "header_background": "#ffffff",
            "header_text": "#111827",
            "footer_background": "#111827",
            "footer_text": "#f9fafb",
            "sidebar_background": "#f9fafb",
            "sidebar_text": "#111827",
            "button_background": "#111827",
            "button_text": "#ffffff",
        },
        "typography": {
            "heading_font": "system",
            "body_font": "system",
            "font_weight": "medium",
            "letter_spacing": "tight",
        },
        "borders": {"radius": "small", "shadow": "none", "border_width": "thin"},
        "buttons": {"shape": "square", "size": "medium"},
        "cards": {"shadow": "none", "radius": "small"},
        "background": {"gradient": "none"},
    },
    component_overrides={"header": {"layout": "center"}},
)

_MODERN_TOKENS, _MODERN_COMPONENTS = _build(
    token_overrides={
        "colors": {
            "primary": "#4f46e5",
            "secondary": "#0ea5e9",
            "accent": "#f59e0b",
            "page_background": "#ffffff",
            "surface": "#eef2ff",
            "text": "#0f172a",
            "muted_text": "#64748b",
            "border": "#e0e7ff",
            "link": "#4f46e5",
            "link_hover": "#4338ca",
            "button_background": "#4f46e5",
            "button_text": "#ffffff",
            "footer_background": "#1e1b4b",
            "footer_text": "#e0e7ff",
            "sidebar_background": "#eef2ff",
        },
        "typography": {"heading_font": "geometric", "body_font": "system"},
        "borders": {"radius": "medium", "shadow": "medium", "border_width": "thin"},
        "buttons": {"shape": "pill", "size": "medium"},
        "cards": {"shadow": "small", "radius": "medium", "background": "surface"},
        "background": {"gradient": "subtle"},
    },
    component_overrides={
        "header": {"layout": "left", "sticky": True},
        "footer": {"layout": "columns", "show_social": True},
    },
)

_EDITORIAL_TOKENS, _EDITORIAL_COMPONENTS = _build(
    token_overrides={
        "colors": {
            "primary": "#7c2d12",
            "secondary": "#0f766e",
            "accent": "#b45309",
            "page_background": "#fffbf5",
            "surface": "#fdf7ed",
            "text": "#292524",
            "muted_text": "#78716c",
            "border": "#e7e5e4",
            "link": "#7c2d12",
            "link_hover": "#9a3412",
            "header_background": "#fffbf5",
            "header_text": "#292524",
            "footer_background": "#292524",
            "footer_text": "#fdf7ed",
            "sidebar_background": "#fdf7ed",
            "sidebar_text": "#292524",
            "button_background": "#7c2d12",
            "button_text": "#fffbf5",
        },
        "typography": {
            "heading_font": "serif",
            "body_font": "serif",
            "heading_scale": "large",
            "line_height": "relaxed",
            "letter_spacing": "normal",
        },
        "borders": {"radius": "none", "shadow": "none", "border_width": "thin"},
        "buttons": {"shape": "square", "size": "medium"},
        "cards": {"shadow": "none", "radius": "none", "padding": "large"},
        "background": {"gradient": "none"},
    },
    component_overrides={"header": {"layout": "split"}, "footer": {"layout": "simple"}},
)

TEMPLATES: tuple[TemplateDefinition, ...] = (
    TemplateDefinition(
        id="minimal-mono",
        name="Minimal Mono",
        description="A clean, monochrome layout with tight typography and no shadows.",
        tokens=_MINIMAL_TOKENS,
        components=_MINIMAL_COMPONENTS,
    ),
    TemplateDefinition(
        id="modern-indigo",
        name="Modern Indigo",
        description="An indigo palette with rounded pills, soft depth, and a sticky header.",
        tokens=_MODERN_TOKENS,
        components=_MODERN_COMPONENTS,
    ),
    TemplateDefinition(
        id="editorial-serif",
        name="Editorial Serif",
        description="A warm, serif-driven editorial look with square corners and generous padding.",
        tokens=_EDITORIAL_TOKENS,
        components=_EDITORIAL_COMPONENTS,
    ),
)

_TEMPLATES_BY_ID = {template.id: template for template in TEMPLATES}


def list_templates() -> list[TemplateDefinition]:
    """Return every supported template in registration order."""
    return list(TEMPLATES)


def get_template(template_id: str) -> TemplateDefinition | None:
    """Return the template with ``template_id`` or ``None`` when unknown."""
    return _TEMPLATES_BY_ID.get(template_id)
