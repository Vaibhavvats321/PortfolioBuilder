"""Pydantic request/response schemas for portfolio pages."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.slugs import SLUG_MAX_LENGTH, normalize_slug, slug_error
from app.models.page import (
    SEO_DESCRIPTION_MAX_LENGTH,
    SEO_TITLE_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    PageStatus,
)


def _clean_title(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Title must not be empty.")
    return stripped


def _clean_slug(value: str) -> str:
    normalized = normalize_slug(value)
    error = slug_error(normalized, reserved=False)
    if error:
        raise ValueError(error)
    return normalized


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class PageCreate(BaseModel):
    """Payload for creating a page within a portfolio.

    ``slug`` is optional: when omitted the backend derives one from the title.
    """

    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)
    is_homepage: bool = False
    is_visible: bool = True
    seo_title: str | None = Field(default=None, max_length=SEO_TITLE_MAX_LENGTH)
    seo_description: str | None = Field(default=None, max_length=SEO_DESCRIPTION_MAX_LENGTH)

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str) -> str:
        return _clean_title(value)

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_slug(value)

    @field_validator("seo_title", "seo_description")
    @classmethod
    def _check_optional(cls, value: str | None) -> str | None:
        return _clean_optional(value)


class PageUpdate(BaseModel):
    """Payload for updating a page. Only present fields are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX_LENGTH)
    slug: str | None = Field(default=None, max_length=SLUG_MAX_LENGTH)
    is_homepage: bool | None = None
    is_visible: bool | None = None
    seo_title: str | None = Field(default=None, max_length=SEO_TITLE_MAX_LENGTH)
    seo_description: str | None = Field(default=None, max_length=SEO_DESCRIPTION_MAX_LENGTH)

    @field_validator("title")
    @classmethod
    def _check_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_title(value)

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_slug(value)

    @field_validator("seo_title", "seo_description")
    @classmethod
    def _check_optional(cls, value: str | None) -> str | None:
        return _clean_optional(value)

    @model_validator(mode="after")
    def _reject_clearing_required_fields(self) -> PageUpdate:
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Title cannot be null.")
        if "slug" in self.model_fields_set and self.slug is None:
            raise ValueError("Slug cannot be null.")
        return self


class PageResponse(BaseModel):
    """Public representation of a page owned by the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    portfolio_id: uuid.UUID
    title: str
    slug: str
    is_homepage: bool
    is_visible: bool
    status: PageStatus
    sort_order: int
    seo_title: str | None
    seo_description: str | None
    created_at: datetime
    updated_at: datetime


class PageOrderUpdate(BaseModel):
    """Payload for atomically reordering a portfolio's pages.

    ``page_ids`` must be a permutation of the portfolio's current page ids.
    """

    page_ids: list[uuid.UUID]
