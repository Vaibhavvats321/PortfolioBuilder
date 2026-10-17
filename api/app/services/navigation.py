"""Navigation business logic.

Navigation is stored as an ordered list per portfolio and replaced atomically:
the client sends the full desired list and the server validates every
destination against the portfolio before swapping the stored rows. This keeps
ordering, creation, editing, and deletion in a single consistent transaction.
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.navigation import NavigationDestinationType, NavigationItem
from app.models.page import Page
from app.models.portfolio import Portfolio
from app.schemas.navigation import NavigationItemInput


class NavigationError(Exception):
    """Base class for navigation domain errors."""


class InvalidNavigationError(NavigationError):
    """Raised when navigation input fails business validation (HTTP 422)."""


def list_navigation(db: Session, *, portfolio: Portfolio) -> list[NavigationItem]:
    """Return the portfolio's navigation items in explicit order."""
    return list(
        db.scalars(
            select(NavigationItem)
            .where(NavigationItem.portfolio_id == portfolio.id)
            .order_by(NavigationItem.sort_order, NavigationItem.id)
        )
    )


def replace_navigation(
    db: Session, *, portfolio: Portfolio, items: list[NavigationItemInput]
) -> list[NavigationItem]:
    """Atomically replace the portfolio's navigation with ``items``.

    Each page destination must reference a page that belongs to ``portfolio``;
    external destinations must already be validated as http(s) URLs by the
    schema. Any existing items are removed in the same transaction.
    """
    owned_page_ids = {
        page_id for page_id in db.scalars(select(Page.id).where(Page.portfolio_id == portfolio.id))
    }
    _validate_destinations(items=items, owned_page_ids=owned_page_ids)

    db.execute(delete(NavigationItem).where(NavigationItem.portfolio_id == portfolio.id))
    new_items = [
        NavigationItem(
            portfolio_id=portfolio.id,
            location=item.location.value,
            label=item.label,
            destination_type=item.destination_type.value,
            page_id=item.page_id,
            external_url=item.external_url,
            sort_order=index,
            is_visible=item.is_visible,
        )
        for index, item in enumerate(items)
    ]
    db.add_all(new_items)
    db.commit()
    for nav_item in new_items:
        db.refresh(nav_item)
    return new_items


def _validate_destinations(
    *, items: list[NavigationItemInput], owned_page_ids: set[uuid.UUID]
) -> None:
    """Reject page destinations that do not belong to the portfolio.

    Location and destination-consistency rules are enforced by the request
    schema; only portfolio ownership needs database context.
    """
    for item in items:
        if (
            item.destination_type == NavigationDestinationType.PAGE
            and item.page_id not in owned_page_ids
        ):
            raise InvalidNavigationError(
                "Every page destination must reference a page in this portfolio."
            )
