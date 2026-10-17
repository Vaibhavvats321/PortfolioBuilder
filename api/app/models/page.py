"""Portfolio page model.

A page belongs to one portfolio and is the container for sections (introduced in
a later phase). In this phase a page carries its routing metadata only: title,
slug, homepage flag, navigation visibility, publication status, explicit
ordering, and SEO fields.

Invariants enforced at the database level:

- Page slugs are unique within a portfolio (``uq_pages_portfolio_slug``).
- At most one page per portfolio can be the homepage, via a partial unique
  index (``uq_pages_portfolio_homepage``).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.slugs import SLUG_MAX_LENGTH
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio

TITLE_MAX_LENGTH = 200
SEO_TITLE_MAX_LENGTH = 200
SEO_DESCRIPTION_MAX_LENGTH = 500


class PageStatus(StrEnum):
    """Publication state of a page.

    Pages start as ``draft``. Publishing is not part of this phase; the value is
    stored so later phases can act on it without a data migration. Publication
    state is deliberately distinct from ``is_visible`` (navigation visibility).
    """

    DRAFT = "draft"
    PUBLISHED = "published"


class Page(Base):
    """A single page within a portfolio."""

    __tablename__ = "pages"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="ck_pages_status"),
        UniqueConstraint("portfolio_id", "slug", name="uq_pages_portfolio_slug"),
        Index(
            "uq_pages_portfolio_homepage",
            "portfolio_id",
            unique=True,
            postgresql_where=text("is_homepage"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(TITLE_MAX_LENGTH), nullable=False)
    slug: Mapped[str] = mapped_column(String(SLUG_MAX_LENGTH), nullable=False)
    is_homepage: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    is_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PageStatus.DRAFT.value,
        server_default=PageStatus.DRAFT.value,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    seo_title: Mapped[str | None] = mapped_column(String(SEO_TITLE_MAX_LENGTH), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(
        String(SEO_DESCRIPTION_MAX_LENGTH), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    portfolio: Mapped[Portfolio] = relationship()
