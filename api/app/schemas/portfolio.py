"""Pydantic request/response schemas for portfolios."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.slugs import SLUG_MAX_LENGTH, normalize_slug, slug_error
from app.models.portfolio import NAME_MAX_LENGTH, PortfolioStatus

DESCRIPTION_MAX_LENGTH = 500


def _clean_name(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Name must not be empty.")
    return stripped


def _clean_slug(value: str) -> str:
    normalized = normalize_slug(value)
    error = slug_error(normalized)
    if error:
        raise ValueError(error)
    return normalized


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class PortfolioCreate(BaseModel):
    """Payload for creating a portfolio.

    ``slug`` is optional: when omitted the backend derives one from the name.
    Supplying a slug that is already taken is reported as a conflict rather
    than silently altered.
    """

    name: str = Field(min_length=1, max_length=NAME_MAX_LENGTH)
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)

    @field_validator("name")
    @classmethod
    def _check_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_slug(value)

    @field_validator("description")
    @classmethod
    def _check_description(cls, value: str | None) -> str | None:
        return _clean_description(value)


class PortfolioUpdate(BaseModel):
    """Payload for updating portfolio metadata.

    Only the fields that are present are changed. ``name`` and ``slug`` cannot
    be cleared; ``description`` can be cleared by sending an empty value.
    """

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX_LENGTH)
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)

    @field_validator("name")
    @classmethod
    def _check_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_name(value)

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_slug(value)

    @field_validator("description")
    @classmethod
    def _check_description(cls, value: str | None) -> str | None:
        return _clean_description(value)

    @model_validator(mode="after")
    def _reject_clearing_required_fields(self) -> PortfolioUpdate:
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Name cannot be null.")
        if "slug" in self.model_fields_set and self.slug is None:
            raise ValueError("Slug cannot be null.")
        return self


class PortfolioResponse(BaseModel):
    """Public representation of a portfolio owned by the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    status: PortfolioStatus
    settings_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime
