"""Portfolio navigation item model.

Navigation items belong to a portfolio and are grouped by location (header,
footer, sidebar). Each item points either to one of the portfolio's pages or to
an external URL; the destination is stored explicitly and kept consistent by a
database check constraint as well as application validation.

``page_id`` uses ``ON DELETE CASCADE`` so removing a page also removes any
navigation items that pointed at it, avoiding dangling destinations.
"""

from __future__ import annotations

import uuid
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.page import Page
    from app.models.portfolio import Portfolio

LABEL_MAX_LENGTH = 120
EXTERNAL_URL_MAX_LENGTH = 2048


class NavigationLocation(StrEnum):
    """Where a navigation item is rendered."""

    HEADER = "header"
    FOOTER = "footer"
    SIDEBAR = "sidebar"


class NavigationDestinationType(StrEnum):
    """What a navigation item links to."""

    PAGE = "page"
    EXTERNAL_URL = "external_url"


class NavigationItem(Base):
    """An ordered navigation link within a portfolio."""

    __tablename__ = "navigation_items"
    __table_args__ = (
        CheckConstraint(
            "location IN ('header', 'footer', 'sidebar')",
            name="ck_navigation_items_location",
        ),
        CheckConstraint(
            "destination_type IN ('page', 'external_url')",
            name="ck_navigation_items_destination_type",
        ),
        CheckConstraint(
            "(destination_type = 'page' AND page_id IS NOT NULL AND external_url IS NULL) OR "
            "(destination_type = 'external_url' AND external_url IS NOT NULL AND page_id IS NULL)",
            name="ck_navigation_items_destination_consistency",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(LABEL_MAX_LENGTH), nullable=False)
    destination_type: Mapped[str] = mapped_column(String(20), nullable=False)
    page_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("pages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    external_url: Mapped[str | None] = mapped_column(String(EXTERNAL_URL_MAX_LENGTH), nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    is_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    portfolio: Mapped[Portfolio] = relationship()
    page: Mapped[Page | None] = relationship()
