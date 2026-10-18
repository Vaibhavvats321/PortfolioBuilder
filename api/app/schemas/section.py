"""Pydantic request/response schemas for page sections.

The section-type schemas expose the registry descriptors so the visual editor
can render generic controls and pre-fill defaults without hardcoding any section
shape in the frontend.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.page_section import SECTION_NAME_MAX_LENGTH
from app.sections.fields import SectionField
from app.sections.registry import SectionDefinition


class SectionFieldSchema(BaseModel):
    """Serialized form of a registry :class:`SectionField`."""

    name: str
    kind: str
    label: str
    required: bool
    max_length: int | None = None
    options: list[str] = Field(default_factory=list)
    default: Any = None
    placeholder: str | None = None
    help_text: str | None = None
    item_label: str | None = None
    max_items: int = 50
    fields: list[SectionFieldSchema] = Field(default_factory=list)

    @classmethod
    def from_field(cls, field_spec: SectionField) -> SectionFieldSchema:
        return cls(
            name=field_spec.name,
            kind=field_spec.kind,
            label=field_spec.label,
            required=field_spec.required,
            max_length=field_spec.max_length,
            options=list(field_spec.options),
            default=field_spec.default,
            placeholder=field_spec.placeholder,
            help_text=field_spec.help_text,
            item_label=field_spec.item_label,
            max_items=field_spec.max_items,
            fields=[cls.from_field(child) for child in field_spec.fields],
        )


class SectionTypeSchema(BaseModel):
    """A supported section type and its editable fields."""

    type_id: str
    label: str
    description: str
    group: str
    schema_version: int
    content_fields: list[SectionFieldSchema]
    layout_fields: list[SectionFieldSchema]
    style_fields: list[SectionFieldSchema]
    default_content: dict[str, Any]
    default_layout: dict[str, Any]
    default_style: dict[str, Any]

    @classmethod
    def from_definition(cls, definition: SectionDefinition) -> SectionTypeSchema:
        return cls(
            type_id=definition.type_id,
            label=definition.label,
            description=definition.description,
            group=definition.group,
            schema_version=definition.schema_version,
            content_fields=[SectionFieldSchema.from_field(f) for f in definition.content_fields],
            layout_fields=[SectionFieldSchema.from_field(f) for f in definition.layout_fields],
            style_fields=[SectionFieldSchema.from_field(f) for f in definition.style_fields],
            default_content=definition.default_content(),
            default_layout=definition.default_layout(),
            default_style=definition.default_style(),
        )


class SectionCreate(BaseModel):
    """Payload for adding a section to a page.

    ``content`` and ``layout`` are optional; omitted fields fall back to the
    registry defaults for the chosen section type.
    """

    section_type: str = Field(min_length=1)
    name: str | None = Field(default=None, max_length=SECTION_NAME_MAX_LENGTH)
    is_visible: bool = True
    content: dict[str, Any] = Field(default_factory=dict)
    layout: dict[str, Any] = Field(default_factory=dict)
    style: dict[str, Any] = Field(default_factory=dict)


class SectionUpdate(BaseModel):
    """Payload for updating a section. Only present fields are changed.

    ``section_type`` is immutable; to change a section's type, delete and add a
    new one. ``content`` and ``layout`` replace the stored value wholesale and
    are re-validated against the section type.
    """

    name: str | None = Field(default=None, min_length=1, max_length=SECTION_NAME_MAX_LENGTH)
    is_visible: bool | None = None
    content: dict[str, Any] | None = None
    layout: dict[str, Any] | None = None
    style: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _reject_clearing_name(self) -> SectionUpdate:
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Name cannot be null.")
        return self


class SectionResponse(BaseModel):
    """Public representation of a section owned by the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    page_id: uuid.UUID
    section_type: str
    name: str
    sort_order: int
    is_visible: bool
    content: dict[str, Any] = Field(validation_alias="content_json")
    layout: dict[str, Any] = Field(validation_alias="layout_json")
    style: dict[str, Any] = Field(validation_alias="style_json")
    schema_version: int
    created_at: datetime
    updated_at: datetime


class SectionOrderUpdate(BaseModel):
    """Payload for atomically reordering a page's sections.

    ``section_ids`` must be a permutation of the page's current section ids.
    """

    section_ids: list[uuid.UUID]
