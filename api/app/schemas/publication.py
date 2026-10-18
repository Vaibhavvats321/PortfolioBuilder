"""Pydantic schemas for publication and draft preview responses."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.portfolio import PortfolioStatus
from app.schemas.navigation import NavigationItemResponse


class PreviewSection(BaseModel):
    """One section as stored in the draft/snapshot payload.

    Mirrors ``SectionResponse`` but without the ORM-only ``*_json`` aliases so
    it validates both snapshot dictionaries and preview dictionaries.
    """

    id: uuid.UUID
    page_id: uuid.UUID
    section_type: str
    name: str
    sort_order: int
    is_visible: bool
    content: dict[str, Any]
    layout: dict[str, Any]
    style: dict[str, Any]
    schema_version: int
    created_at: datetime
    updated_at: datetime


class PublishResponse(BaseModel):
    """Result of a successful publication.

    ``public_path`` is returned only after the snapshot commit succeeded, so
    the UI can reveal the public URL exclusively on success.
    """

    status: PortfolioStatus
    published_at: datetime
    version_number: int
    public_path: str


class PreviewPortfolio(BaseModel):
    """Portfolio metadata as shown in the draft preview."""

    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    status: PortfolioStatus
    published_at: datetime | None


class PreviewPage(BaseModel):
    """One draft page with its ordered sections."""

    id: uuid.UUID
    title: str
    slug: str
    is_homepage: bool
    is_visible: bool
    sort_order: int
    seo_title: str | None
    seo_description: str | None
    created_at: datetime
    updated_at: datetime
    sections: list[PreviewSection]


class PreviewTheme(BaseModel):
    """Canonical theme payload shared by preview and snapshots."""

    schema_version: int
    tokens: dict[str, Any]
    components: dict[str, Any]


class PreviewMedia(BaseModel):
    """Media reference with its stable serving URL."""

    id: uuid.UUID
    original_filename: str
    mime_type: str
    width: int | None
    height: int | None
    alt_text: str | None
    caption: str | None
    url: str


class PreviewResponse(BaseModel):
    """Live draft bundle for the authenticated, noindex draft preview."""

    portfolio: PreviewPortfolio
    pages: list[PreviewPage]
    navigation: list[NavigationItemResponse]
    theme: PreviewTheme
    media: list[PreviewMedia]

    model_config = ConfigDict(from_attributes=True)
