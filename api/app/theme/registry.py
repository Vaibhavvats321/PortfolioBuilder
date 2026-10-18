"""Theme token and component descriptors.

The theme registry is split into two validated slices:

* **tokens** - global design tokens (colors, typography, spacing, borders,
  buttons, cards, links, background) that every section inherits.
* **components** - site chrome options (header, footer, sidebar, branding,
  social) that describe the global layout.

Each slice is an ordered list of :class:`ThemeGroup` objects. A group is a set
of fields validated with the same shared engine as section fields, so unknown
keys are rejected and every value is length/format bounded. Missing groups are
filled with their defaults, which lets the API accept partial design payloads
without ever storing an incomplete document.

Colors are restricted to hex values and fonts to a small, safe catalog of
system font stacks; no arbitrary remote font URLs are accepted in this release.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.sections.fields import (
    URL_MAX_LENGTH,
    SectionField,
    SectionValidationError,
    default_fields,
    validate_fields,
)

THEME_SCHEMA_VERSION = 1

# Safe, offline font stacks. The frontend maps these keys to concrete CSS
# ``font-family`` values; no remote font is downloaded, which keeps previews
# private and avoids third-party requests.
FONT_OPTIONS: tuple[str, ...] = ("system", "humanist", "geometric", "serif", "mono")

_TEXT_MAX = 200

# Help text for controls that the editor preview cannot demonstrate, so the UI
# can label them as published-site (or stateful) settings instead of implying
# they are broken. Previewable controls leave ``help_text`` unset.
_HELP_STICKY = (
    "Applies on the published site when visitors scroll; the editor preview stays static."
)
_HELP_COLLAPSE = (
    "Applies to the published site's mobile layout; the editor preview has a fixed width."
)
_HELP_FAVICON = "Sets the published site's browser tab icon; not shown in the editor preview."
_HELP_CTA_URL = "Destination for the CTA on the published site; the preview shows the label only."
_HELP_SOCIAL_URL = "Opens from the published footer; the preview shows the platform chip only."
_HELP_LINK_HOVER = "Colour used when a link is hovered — hover the preview link to compare."
_HELP_SIDEBAR_COLOR = "Only visible when the sidebar is enabled under Global layout."


@dataclass(frozen=True)
class ThemeGroup:
    """A named, ordered group of editable design fields."""

    name: str
    label: str
    description: str
    fields: tuple[SectionField, ...]

    def default(self) -> dict[str, Any]:
        """Return the default mapping for this group."""
        return default_fields(self.fields)

    def validate(self, value: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize ``value`` against this group's fields."""
        return validate_fields(self.fields, value, path=self.name)


def _color(name: str, label: str, default: str, *, help_text: str | None = None) -> SectionField:
    return SectionField(name=name, kind="color", label=label, default=default, help_text=help_text)


def _select(
    name: str,
    label: str,
    options: tuple[str, ...],
    default: str,
    *,
    help_text: str | None = None,
) -> SectionField:
    return SectionField(
        name=name,
        kind="select",
        label=label,
        options=options,
        default=default,
        help_text=help_text,
    )


TOKEN_GROUPS: tuple[ThemeGroup, ...] = (
    ThemeGroup(
        name="colors",
        label="Colors",
        description="Core palette used across the site and inherited by sections.",
        fields=(
            _color("primary", "Primary", "#4f46e5"),
            _color("secondary", "Secondary", "#0ea5e9"),
            _color("accent", "Accent", "#f59e0b"),
            _color("page_background", "Page background", "#ffffff"),
            _color("surface", "Surface", "#f8fafc"),
            _color("text", "Body text", "#0f172a"),
            _color("muted_text", "Muted text", "#64748b"),
            _color("border", "Border", "#e2e8f0"),
            _color("link", "Link", "#4f46e5"),
            _color("link_hover", "Link hover", "#4338ca", help_text=_HELP_LINK_HOVER),
            _color("header_background", "Header background", "#ffffff"),
            _color("header_text", "Header text", "#0f172a"),
            _color("footer_background", "Footer background", "#0f172a"),
            _color("footer_text", "Footer text", "#f8fafc"),
            _color(
                "sidebar_background",
                "Sidebar background",
                "#f8fafc",
                help_text=_HELP_SIDEBAR_COLOR,
            ),
            _color("sidebar_text", "Sidebar text", "#0f172a", help_text=_HELP_SIDEBAR_COLOR),
            _color("button_background", "Button background", "#4f46e5"),
            _color("button_text", "Button text", "#ffffff"),
        ),
    ),
    ThemeGroup(
        name="typography",
        label="Typography",
        description="Headings, body text, and text case.",
        fields=(
            _select("heading_font", "Heading font", FONT_OPTIONS, "system"),
            _select("body_font", "Body font", FONT_OPTIONS, "system"),
            _select("base_size", "Base size", ("small", "medium", "large"), "medium"),
            _select("heading_scale", "Heading scale", ("compact", "normal", "large"), "normal"),
            _select(
                "font_weight", "Font weight", ("regular", "medium", "semibold", "bold"), "regular"
            ),
            _select("line_height", "Line height", ("tight", "normal", "relaxed"), "normal"),
            _select("letter_spacing", "Letter spacing", ("tight", "normal", "wide"), "normal"),
            _select("text_align", "Text align", ("left", "center"), "left"),
            _select(
                "text_transform", "Text transform", ("none", "uppercase", "capitalize"), "none"
            ),
        ),
    ),
    ThemeGroup(
        name="spacing",
        label="Spacing",
        description="Content width, section rhythm, and container padding.",
        fields=(
            _select(
                "content_width", "Content width", ("narrow", "default", "wide", "full"), "default"
            ),
            _select(
                "section_spacing", "Section spacing", ("compact", "normal", "spacious"), "normal"
            ),
            _select(
                "container_padding",
                "Container padding",
                ("none", "small", "medium", "large"),
                "medium",
            ),
            _select("grid_gap", "Grid gap", ("none", "small", "medium", "large"), "medium"),
        ),
    ),
    ThemeGroup(
        name="borders",
        label="Borders & shadows",
        description="Corner radius, border weight, and elevation.",
        fields=(
            _select(
                "radius", "Corner radius", ("none", "small", "medium", "large", "pill"), "medium"
            ),
            _select("border_width", "Border width", ("none", "thin", "thick"), "thin"),
            _select("shadow", "Shadow", ("none", "small", "medium", "large"), "small"),
        ),
    ),
    ThemeGroup(
        name="buttons",
        label="Buttons",
        description="Shape and size of call-to-action buttons.",
        fields=(
            _select("shape", "Shape", ("square", "rounded", "pill"), "rounded"),
            _select("size", "Size", ("small", "medium", "large"), "medium"),
        ),
    ),
    ThemeGroup(
        name="cards",
        label="Cards",
        description="Default styling for cards, panels, and grids.",
        fields=(
            _select("background", "Background", ("surface", "page", "transparent"), "surface"),
            _select("border", "Border", ("none", "thin", "thick"), "thin"),
            _select(
                "radius", "Corner radius", ("none", "small", "medium", "large", "pill"), "medium"
            ),
            _select("shadow", "Shadow", ("none", "small", "medium", "large"), "small"),
            _select("padding", "Padding", ("none", "small", "medium", "large"), "medium"),
        ),
    ),
    ThemeGroup(
        name="links",
        label="Links",
        description="Inline link decoration and emphasis.",
        fields=(
            _select("underline", "Underline", ("always", "hover", "never"), "hover"),
            _select("style", "Style", ("plain", "bold"), "plain"),
        ),
    ),
    ThemeGroup(
        name="background",
        label="Background",
        description="Optional page background treatment.",
        fields=(_select("gradient", "Gradient", ("none", "subtle", "brand"), "none"),),
    ),
)

LAYOUT_GROUPS: tuple[ThemeGroup, ...] = (
    ThemeGroup(
        name="header",
        label="Header",
        description="Top navigation bar and optional call to action.",
        fields=(
            SectionField(name="visible", kind="boolean", label="Show header", default=True),
            _select("layout", "Layout", ("left", "center", "split"), "left"),
            SectionField(
                name="sticky",
                kind="boolean",
                label="Sticky on scroll",
                default=False,
                help_text=_HELP_STICKY,
            ),
            SectionField(name="show_logo", kind="boolean", label="Show logo", default=True),
            SectionField(
                name="show_navigation", kind="boolean", label="Show navigation", default=True
            ),
            SectionField(name="cta_label", kind="text", label="CTA label", max_length=60),
            SectionField(
                name="cta_url",
                kind="url",
                label="CTA URL",
                max_length=URL_MAX_LENGTH,
                help_text=_HELP_CTA_URL,
            ),
        ),
    ),
    ThemeGroup(
        name="footer",
        label="Footer",
        description="Bottom area with copyright and optional social links.",
        fields=(
            SectionField(name="visible", kind="boolean", label="Show footer", default=True),
            _select("layout", "Layout", ("simple", "columns"), "simple"),
            SectionField(name="copyright", kind="text", label="Copyright", max_length=_TEXT_MAX),
            SectionField(
                name="show_social", kind="boolean", label="Show social links", default=True
            ),
        ),
    ),
    ThemeGroup(
        name="sidebar",
        label="Sidebar",
        description="Optional side panel for navigation or content.",
        fields=(
            SectionField(name="visible", kind="boolean", label="Show sidebar", default=False),
            _select("position", "Position", ("left", "right"), "left"),
            _select("width", "Width", ("narrow", "default", "wide"), "default"),
            SectionField(
                name="collapse_on_mobile",
                kind="boolean",
                label="Collapse on mobile",
                default=True,
                help_text=_HELP_COLLAPSE,
            ),
        ),
    ),
    ThemeGroup(
        name="branding",
        label="Branding",
        description="Logo, favicon, and tagline.",
        fields=(
            SectionField(name="logo_text", kind="text", label="Logo text", max_length=60),
            SectionField(
                name="logo_image_url", kind="url", label="Logo image URL", max_length=URL_MAX_LENGTH
            ),
            SectionField(
                name="favicon_url",
                kind="url",
                label="Favicon URL",
                max_length=URL_MAX_LENGTH,
                help_text=_HELP_FAVICON,
            ),
            SectionField(name="tagline", kind="text", label="Tagline", max_length=120),
        ),
    ),
    ThemeGroup(
        name="social",
        label="Social links",
        description="Profiles linked from the footer or header.",
        fields=(
            SectionField(
                name="links",
                kind="repeater",
                label="Social links",
                item_label="Link",
                max_items=10,
                fields=(
                    SectionField(
                        name="platform",
                        kind="select",
                        label="Platform",
                        options=(
                            "website",
                            "email",
                            "twitter",
                            "linkedin",
                            "github",
                            "dribbble",
                            "instagram",
                            "youtube",
                            "mastodon",
                        ),
                        default="website",
                    ),
                    SectionField(
                        name="url",
                        kind="url",
                        label="URL",
                        max_length=URL_MAX_LENGTH,
                        help_text=_HELP_SOCIAL_URL,
                    ),
                ),
            ),
        ),
    ),
)


def default_tokens() -> dict[str, dict[str, Any]]:
    """Return the default token groups."""
    return {group.name: group.default() for group in TOKEN_GROUPS}


def default_components() -> dict[str, dict[str, Any]]:
    """Return the default component groups."""
    return {group.name: group.default() for group in LAYOUT_GROUPS}


def validate_tokens(value: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Validate a token document, filling missing groups with defaults."""
    return _validate_groups(TOKEN_GROUPS, value, path="tokens")


def validate_components(value: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Validate a component document, filling missing groups with defaults."""
    return _validate_groups(LAYOUT_GROUPS, value, path="components")


def _validate_groups(
    groups: tuple[ThemeGroup, ...], value: dict[str, Any], *, path: str
) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict):
        raise SectionValidationError(f"{path} must be an object.")

    known = {group.name for group in groups}
    unknown = sorted(set(value) - known)
    if unknown:
        raise SectionValidationError(f"{path} contains unknown group(s): {', '.join(unknown)}.")

    result: dict[str, dict[str, Any]] = {}
    for group in groups:
        result[group.name] = group.validate(value.get(group.name, {}))
    return result
