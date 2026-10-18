"""Theme configuration model.

Each portfolio has at most one canonical theme configuration. The validated
design data is stored as a single ``config_json`` document with two top-level
slices, ``tokens`` (colors, typography, spacing, buttons, cards, links,
background) and ``components`` (header, footer, sidebar, branding, social).
Keeping one row per portfolio means the theme can be read or replaced
atomically and cannot drift across multiple partial records.

``schema_version`` records the theme registry schema the document was written
with so future migrations can upgrade old themes safely. The row is removed
with its portfolio via ``ON DELETE CASCADE``.
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
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio


class ThemeConfig(Base):
    """The canonical, owner-scoped theme configuration for one portfolio."""

    __tablename__ = "theme_configs"
    __table_args__ = (
        CheckConstraint("schema_version >= 1", name="ck_theme_configs_schema_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    config_json: Mapped[dict[str, Any]] = mapped_column(
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

    portfolio: Mapped[Portfolio] = relationship()
