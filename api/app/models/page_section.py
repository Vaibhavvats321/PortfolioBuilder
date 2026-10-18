"""Page section model.

A section is an ordered, typed block of content within a page. The
``section_type`` identifies which registry definition validates and renders it;
``content_json`` and ``layout_json`` hold the validated, versioned
configuration. ``schema_version`` records the registry schema the row was
written with so future migrations can upgrade old content safely.

Sections belong to a page and are removed with it via ``ON DELETE CASCADE``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.page import Page

SECTION_TYPE_MAX_LENGTH = 50
SECTION_NAME_MAX_LENGTH = 120


class PageSection(Base):
    """One ordered, typed section within a page."""

    __tablename__ = "page_sections"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_page_sections_sort_order"),
        CheckConstraint("schema_version >= 1", name="ck_page_sections_schema_version"),
        Index("ix_page_sections_page_id", "page_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    page_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False
    )
    section_type: Mapped[str] = mapped_column(String(SECTION_TYPE_MAX_LENGTH), nullable=False)
    name: Mapped[str] = mapped_column(String(SECTION_NAME_MAX_LENGTH), nullable=False)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    is_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    content_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    layout_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    style_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    schema_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    page: Mapped[Page] = relationship()
