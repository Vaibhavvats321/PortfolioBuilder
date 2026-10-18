"""Pydantic request/response schemas for the theme and design studio.

The options schema exposes the registry descriptors so the visual editor can
render generic controls and pre-fill defaults without hardcoding any design
shape in the frontend, matching the section-type approach.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.theme_config import ThemeConfig
from app.schemas.section import SectionFieldSchema
from app.theme.registry import ThemeGroup
from app.theme.templates import TemplateDefinition


class ThemeGroupSchema(BaseModel):
    """A named group of editable design fields and its default values."""

    name: str
    label: str
    description: str
    fields: list[SectionFieldSchema]
    default: dict[str, Any]

    @classmethod
    def from_group(cls, group: ThemeGroup) -> ThemeGroupSchema:
        return cls(
            name=group.name,
            label=group.label,
            description=group.description,
            fields=[SectionFieldSchema.from_field(field) for field in group.fields],
            default=group.default(),
        )


class ThemeOptionsResponse(BaseModel):
    """Static design option descriptors and defaults for the editor."""

    schema_version: int
    token_groups: list[ThemeGroupSchema]
    layout_groups: list[ThemeGroupSchema]
    default_tokens: dict[str, Any]
    default_components: dict[str, Any]


class ThemeUpdate(BaseModel):
    """Payload that replaces a portfolio's theme tokens (global design)."""

    tokens: dict[str, Any]


class GlobalLayoutUpdate(BaseModel):
    """Payload that replaces a portfolio's component/global-layout options."""

    components: dict[str, Any]


class ThemeResponse(BaseModel):
    """The validated theme (tokens + components) for one portfolio."""

    portfolio_id: uuid.UUID
    schema_version: int
    tokens: dict[str, Any]
    components: dict[str, Any]
    updated_at: datetime

    @classmethod
    def from_config(cls, config: ThemeConfig) -> ThemeResponse:
        payload = config.config_json or {}
        return cls(
            portfolio_id=config.portfolio_id,
            schema_version=payload.get("schema_version", config.schema_version),
            tokens=payload.get("tokens", {}),
            components=payload.get("components", {}),
            updated_at=config.updated_at,
        )


class GlobalLayoutResponse(BaseModel):
    """Only the component/global-layout slice of a portfolio's theme."""

    portfolio_id: uuid.UUID
    schema_version: int
    components: dict[str, Any]
    updated_at: datetime

    @classmethod
    def from_config(cls, config: ThemeConfig) -> GlobalLayoutResponse:
        payload = config.config_json or {}
        return cls(
            portfolio_id=config.portfolio_id,
            schema_version=payload.get("schema_version", config.schema_version),
            components=payload.get("components", {}),
            updated_at=config.updated_at,
        )


class TemplateSchema(BaseModel):
    """A starter design template and the design it applies."""

    id: str
    name: str
    description: str
    tokens: dict[str, Any]
    components: dict[str, Any]

    @classmethod
    def from_definition(cls, definition: TemplateDefinition) -> TemplateSchema:
        return cls(
            id=definition.id,
            name=definition.name,
            description=definition.description,
            tokens=definition.tokens,
            components=definition.components,
        )
