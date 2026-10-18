"""Media asset model.

A media asset belongs to a portfolio and represents an uploaded file. The actual
binary is stored in the configured storage backend. Only metadata and the
storage_key live in PostgreSQL.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio

FILENAME_MAX_LENGTH = 255
MIME_MAX_LENGTH = 127
STORAGE_KEY_MAX_LENGTH = 512
ALT_TEXT_MAX_LENGTH = 255
CAPTION_MAX_LENGTH = 500


class MediaAsset(Base):
    """An uploaded file owned by a portfolio."""

    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="ck_media_assets_size_positive"),
        CheckConstraint("width IS NULL OR width > 0", name="ck_media_assets_width_positive"),
        CheckConstraint("height IS NULL OR height > 0", name="ck_media_assets_height_positive"),
        UniqueConstraint("portfolio_id", "storage_key", name="uq_media_assets_portfolio_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(
        String(STORAGE_KEY_MAX_LENGTH), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(FILENAME_MAX_LENGTH), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(MIME_MAX_LENGTH), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(ALT_TEXT_MAX_LENGTH), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(CAPTION_MAX_LENGTH), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    portfolio: Mapped[Portfolio] = relationship()
