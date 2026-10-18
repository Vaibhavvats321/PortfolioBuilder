"""ORM models.

Importing this package registers every model on ``Base.metadata`` so Alembic
autogeneration and ``create_all`` can see the full schema.
"""

from app.models.media_asset import MediaAsset
from app.models.navigation import (
    NavigationDestinationType,
    NavigationItem,
    NavigationLocation,
)
from app.models.page import Page, PageStatus
from app.models.page_section import PageSection
from app.models.portfolio import Portfolio, PortfolioStatus
from app.models.portfolio_version import PortfolioVersion
from app.models.session import Session
from app.models.theme_config import ThemeConfig
from app.models.user import User

__all__ = [
    "NavigationDestinationType",
    "NavigationItem",
    "NavigationLocation",
    "Page",
    "PageStatus",
    "PageSection",
    "Portfolio",
    "PortfolioStatus",
    "PortfolioVersion",
    "Session",
    "ThemeConfig",
    "MediaAsset",
    "User",
]
