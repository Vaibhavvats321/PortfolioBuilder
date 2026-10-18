"""Published portfolio version (immutable snapshot).

A version row is created exactly once per publication and is never mutated
afterwards: ``snapshot_json`` captures the complete configuration needed to
render the published site (portfolio metadata, pages with sections,
navigation, theme, and media references). The portfolio's
``current_published_version_id`` points at the active version; republishing
creates a *new* row rather than editing an old one, so version history can be
added later without changing this table's semantics.

Deleting a portfolio removes its versions (``ON DELETE CASCADE``); deleting a
version row only happens together with its portfolio, hence the portfolio's
pointer uses ``ON DELETE SET NULL`` as a defensive measure.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio
    from app.models.user import User

SNAPSHOT_SCHEMA_VERSION = 1


class PortfolioVersion(Base):
    """One immutable publication snapshot of a portfolio."""

    __tablename__ = "portfolio_versions"
    __table_args__ = (
        CheckConstraint("version_number >= 1", name="ck_portfolio_versions_number_positive"),
        UniqueConstraint(
            "portfolio_id",
            "version_number",
            name="uq_portfolio_versions_portfolio_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "portfolios.id",
            ondelete="CASCADE",
            name="fk_portfolio_versions_portfolio_id",
        ),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    published_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    portfolio: Mapped[Portfolio] = relationship(
        back_populates="versions", foreign_keys=[portfolio_id]
    )
    publisher: Mapped[User] = relationship(foreign_keys=[published_by])
