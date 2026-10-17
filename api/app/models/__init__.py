"""ORM models.

Importing this package registers every model on ``Base.metadata`` so Alembic
autogeneration and ``create_all`` can see the full schema.
"""

from app.models.navigation import (
    NavigationDestinationType,
    NavigationItem,
    NavigationLocation,
)
from app.models.page import Page, PageStatus
from app.models.portfolio import Portfolio, PortfolioStatus
from app.models.session import Session
from app.models.user import User

__all__ = [
    "NavigationDestinationType",
    "NavigationItem",
    "NavigationLocation",
    "Page",
    "PageStatus",
    "Portfolio",
    "PortfolioStatus",
    "Session",
    "User",
]
