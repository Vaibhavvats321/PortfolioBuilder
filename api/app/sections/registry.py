"""Typed section registry: the single source of truth for supported sections.

Each :class:`SectionDefinition` declares a stable type id, a schema version, and
the content and layout fields. Defaults, backend validation, and the visual
editor controls are all derived from these descriptors (see ``fields.py``), so a
section type is defined exactly once.

The registry is intentionally code (it is part of the engine), while the
*values* a user enters are stored as validated JSON on ``page_sections``. Adding
a new type here is all that is required to support it across the API and
editor; the public renderer (a later phase) renders the same stored data.
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

# A section's content JSON is validated but otherwise free of size concerns; the
# cap keeps a single section from growing unbounded.
_TEXT_MAX = 500
_BODY_MAX = 5000

_ALIGNMENT = SectionField(
    name="alignment",
    kind="select",
    label="Alignment",
    options=("left", "center", "right"),
    default="left",
)

_COLUMNS = SectionField(
    name="columns",
    kind="select",
    label="Columns",
    options=("2", "3", "4"),
    default="3",
)

_BUTTON_FIELDS = (
    SectionField(name="label", kind="text", label="Label", max_length=80),
    SectionField(name="url", kind="url", label="URL", max_length=URL_MAX_LENGTH),
)

_LINK_FIELDS = (
    SectionField(name="label", kind="text", label="Label", max_length=80),
    SectionField(name="url", kind="url", label="URL", max_length=URL_MAX_LENGTH),
)


@dataclass(frozen=True)
class SectionDefinition:
    """Everything the engine knows about one supported section type."""

    type_id: str
    label: str
    description: str
    group: str
    schema_version: int
    content_fields: tuple[SectionField, ...]
    layout_fields: tuple[SectionField, ...] = (_ALIGNMENT,)

    def default_content(self) -> dict[str, Any]:
        return default_fields(self.content_fields)

    def default_layout(self) -> dict[str, Any]:
        return default_fields(self.layout_fields)

    def validate_content(self, content: dict[str, Any]) -> dict[str, Any]:
        return validate_fields(self.content_fields, content, path="content")

    def validate_layout(self, layout: dict[str, Any]) -> dict[str, Any]:
        return validate_fields(self.layout_fields, layout, path="layout")


SECTION_TYPES: tuple[SectionDefinition, ...] = (
    SectionDefinition(
        type_id="hero",
        label="Hero",
        description="A prominent headline with optional subheading, body, and buttons.",
        group="Essentials",
        schema_version=1,
        content_fields=(
            SectionField(
                name="heading", kind="text", label="Heading", required=True, max_length=_TEXT_MAX
            ),
            SectionField(name="subheading", kind="text", label="Subheading", max_length=_TEXT_MAX),
            SectionField(name="body", kind="textarea", label="Body", max_length=_BODY_MAX),
            SectionField(
                name="show_availability",
                kind="boolean",
                label="Show availability badge",
                default=False,
            ),
            SectionField(
                name="availability_text",
                kind="text",
                label="Availability text",
                max_length=120,
                placeholder="Available for freelance",
            ),
            SectionField(
                name="buttons",
                kind="repeater",
                label="Buttons",
                item_label="Button",
                max_items=2,
                fields=_BUTTON_FIELDS,
            ),
        ),
    ),
    SectionDefinition(
        type_id="rich_text",
        label="Rich text",
        description="A heading with a block of plain text.",
        group="Essentials",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(name="body", kind="textarea", label="Body", max_length=_BODY_MAX),
        ),
    ),
    SectionDefinition(
        type_id="call_to_action",
        label="Call to action",
        description="A short prompt with a single button.",
        group="Essentials",
        schema_version=1,
        content_fields=(
            SectionField(
                name="heading", kind="text", label="Heading", required=True, max_length=_TEXT_MAX
            ),
            SectionField(name="body", kind="textarea", label="Body", max_length=_BODY_MAX),
            SectionField(
                name="buttons",
                kind="repeater",
                label="Button",
                item_label="Button",
                max_items=1,
                fields=_BUTTON_FIELDS,
            ),
        ),
    ),
    SectionDefinition(
        type_id="contact_details",
        label="Contact details",
        description="Contact information with optional links.",
        group="Essentials",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(name="email", kind="text", label="Email", max_length=200),
            SectionField(name="phone", kind="text", label="Phone", max_length=60),
            SectionField(name="location", kind="text", label="Location", max_length=200),
            SectionField(
                name="links",
                kind="repeater",
                label="Links",
                item_label="Link",
                max_items=12,
                fields=_LINK_FIELDS,
            ),
        ),
    ),
    SectionDefinition(
        type_id="image_text",
        label="Image + text",
        description="An image beside a block of text.",
        group="Media",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(name="body", kind="textarea", label="Body", max_length=_BODY_MAX),
            SectionField(
                name="image_url", kind="url", label="Image URL", max_length=URL_MAX_LENGTH
            ),
            SectionField(name="image_alt", kind="text", label="Image alt text", max_length=200),
        ),
        layout_fields=(
            _ALIGNMENT,
            SectionField(
                name="image_position",
                kind="select",
                label="Image position",
                options=("left", "right"),
                default="left",
            ),
        ),
    ),
    SectionDefinition(
        type_id="image_gallery",
        label="Image gallery",
        description="A grid of images with optional captions.",
        group="Media",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="images",
                kind="repeater",
                label="Images",
                item_label="Image",
                max_items=24,
                fields=(
                    SectionField(
                        name="image_url", kind="url", label="Image URL", max_length=URL_MAX_LENGTH
                    ),
                    SectionField(name="caption", kind="text", label="Caption", max_length=200),
                ),
            ),
        ),
        layout_fields=(_ALIGNMENT, _COLUMNS),
    ),
    SectionDefinition(
        type_id="project_grid",
        label="Project grid",
        description="Cards describing multiple projects.",
        group="Media",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="projects",
                kind="repeater",
                label="Projects",
                item_label="Project",
                max_items=24,
                fields=(
                    SectionField(name="title", kind="text", label="Title", max_length=200),
                    SectionField(
                        name="description", kind="textarea", label="Description", max_length=1000
                    ),
                    SectionField(
                        name="image_url", kind="url", label="Image URL", max_length=URL_MAX_LENGTH
                    ),
                    SectionField(
                        name="link_url", kind="url", label="Link URL", max_length=URL_MAX_LENGTH
                    ),
                ),
            ),
        ),
        layout_fields=(_ALIGNMENT, _COLUMNS),
    ),
    SectionDefinition(
        type_id="skills_grid",
        label="Skills grid",
        description="A list of skills with optional proficiency.",
        group="Lists",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="skills",
                kind="repeater",
                label="Skills",
                item_label="Skill",
                max_items=50,
                fields=(
                    SectionField(name="name", kind="text", label="Name", max_length=120),
                    SectionField(
                        name="level",
                        kind="select",
                        label="Level",
                        options=("", "Beginner", "Intermediate", "Advanced", "Expert"),
                        default="",
                    ),
                ),
            ),
        ),
        layout_fields=(_ALIGNMENT, _COLUMNS),
    ),
    SectionDefinition(
        type_id="experience_timeline",
        label="Experience timeline",
        description="A chronological list of roles.",
        group="Lists",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="entries",
                kind="repeater",
                label="Entries",
                item_label="Entry",
                max_items=50,
                fields=(
                    SectionField(name="role", kind="text", label="Role", max_length=200),
                    SectionField(
                        name="organization", kind="text", label="Organization", max_length=200
                    ),
                    SectionField(name="start_date", kind="text", label="Start date", max_length=40),
                    SectionField(name="end_date", kind="text", label="End date", max_length=40),
                    SectionField(
                        name="description", kind="textarea", label="Description", max_length=2000
                    ),
                ),
            ),
        ),
    ),
    SectionDefinition(
        type_id="testimonials",
        label="Testimonials",
        description="Quotes from clients or colleagues.",
        group="Lists",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="testimonials",
                kind="repeater",
                label="Testimonials",
                item_label="Testimonial",
                max_items=24,
                fields=(
                    SectionField(name="quote", kind="textarea", label="Quote", max_length=1000),
                    SectionField(name="author", kind="text", label="Author", max_length=200),
                    SectionField(name="role", kind="text", label="Role", max_length=200),
                ),
            ),
        ),
        layout_fields=(_ALIGNMENT, _COLUMNS),
    ),
    SectionDefinition(
        type_id="metrics",
        label="Metrics",
        description="Highlighted statistics.",
        group="Lists",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="metrics",
                kind="repeater",
                label="Metrics",
                item_label="Metric",
                max_items=12,
                fields=(
                    SectionField(name="value", kind="text", label="Value", max_length=40),
                    SectionField(name="label", kind="text", label="Label", max_length=120),
                ),
            ),
        ),
        layout_fields=(_ALIGNMENT, _COLUMNS),
    ),
    SectionDefinition(
        type_id="link_list",
        label="Link list",
        description="A simple list of labelled links.",
        group="Lists",
        schema_version=1,
        content_fields=(
            SectionField(name="heading", kind="text", label="Heading", max_length=_TEXT_MAX),
            SectionField(
                name="links",
                kind="repeater",
                label="Links",
                item_label="Link",
                max_items=50,
                fields=_LINK_FIELDS,
            ),
        ),
    ),
    SectionDefinition(
        type_id="divider",
        label="Divider / spacer",
        description="A visual separator or vertical space.",
        group="Layout",
        schema_version=1,
        content_fields=(),
        layout_fields=(
            _ALIGNMENT,
            SectionField(
                name="style",
                kind="select",
                label="Style",
                options=("line", "space"),
                default="line",
            ),
            SectionField(
                name="size",
                kind="select",
                label="Size",
                options=("small", "medium", "large"),
                default="medium",
            ),
        ),
    ),
)

_REGISTRY: dict[str, SectionDefinition] = {
    definition.type_id: definition for definition in SECTION_TYPES
}


class UnknownSectionTypeError(SectionValidationError):
    """Raised when a section type id is not part of the registry."""


def get_definition(type_id: str) -> SectionDefinition | None:
    """Return the definition for ``type_id`` or ``None`` when unsupported."""
    return _REGISTRY.get(type_id)


def require_definition(type_id: str) -> SectionDefinition:
    """Return the definition for ``type_id`` or raise a validation error."""
    definition = _REGISTRY.get(type_id)
    if definition is None:
        raise UnknownSectionTypeError(f"Unsupported section type: {type_id}.")
    return definition


def list_definitions() -> list[SectionDefinition]:
    """Return every supported definition in registry order."""
    return list(SECTION_TYPES)
