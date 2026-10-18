"""Portfolio model.

A portfolio is the top-level, owner-scoped unit of content. It carries metadata
(name, slug, description, status) plus publication pointers: ``published_at``
records the last successful publication time and ``current_published_version_id``
references the active immutable snapshot (``portfolio_versions``). Pages,
sections, navigation, themes, and media live in their own tables as private
draft data.

The slug is the public routing key (``/p/{portfolio_slug}``) and is therefore
unique across the whole platform, not per owner.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.slugs import SLUG_MAX_LENGTH
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.portfolio_version import PortfolioVersion
    from app.models.user import User

NAME_MAX_LENGTH = 120


class PortfolioStatus(StrEnum):
    """Publication state of a portfolio.

    New portfolios start as ``draft``. Publishing validates the draft and
    creates an immutable snapshot in ``portfolio_versions``; unpublishing
    flips the status back to ``draft`` while keeping the version history.
    """

    DRAFT = "draft"
    PUBLISHED = "published"


class Portfolio(Base):
    """A user-owned portfolio website configuration."""

    __tablename__ = "portfolios"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="ck_portfolios_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(SLUG_MAX_LENGTH), nullable=False, unique=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PortfolioStatus.DRAFT.value,
        server_default=PortfolioStatus.DRAFT.value,
    )
    settings_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    current_published_version_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "portfolio_versions.id",
            ondelete="SET NULL",
            name="fk_portfolios_current_published_version",
            use_alter=True,
        ),
        nullable=True,
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship(back_populates="portfolios")
    versions: Mapped[list[PortfolioVersion]] = relationship(
        back_populates="portfolio",
        foreign_keys="PortfolioVersion.portfolio_id",
        order_by="PortfolioVersion.version_number",
        passive_deletes=True,
    )
    current_published_version: Mapped[PortfolioVersion | None] = relationship(
        foreign_keys=[current_published_version_id]
    )
