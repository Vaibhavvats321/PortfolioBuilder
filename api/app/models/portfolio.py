"""Portfolio model.

A portfolio is the top-level, owner-scoped unit of content. In this phase it
carries metadata only (name, slug, description, status); pages, sections,
navigation, themes, media, and published snapshots are introduced in later
phases.

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
    from app.models.user import User

NAME_MAX_LENGTH = 120


class PortfolioStatus(StrEnum):
    """Publication state of a portfolio.

    New portfolios start as ``draft``. Publishing is not part of this phase;
    the value is stored so later phases can act on it without a data migration.
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped[User] = relationship(back_populates="portfolios")
