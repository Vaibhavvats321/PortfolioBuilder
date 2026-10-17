"""Navigation management routes.

Navigation is read and replaced as a whole ordered list. The PUT is
transactional: the stored list is swapped atomically after every destination is
validated against the portfolio.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_owned_portfolio, require_csrf
from app.db.session import get_db
from app.models.navigation import NavigationItem
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.schemas.navigation import NavigationItemResponse, NavigationUpdate
from app.services.navigation import (
    InvalidNavigationError,
    list_navigation,
    replace_navigation,
)

router = APIRouter(tags=["navigation"])


@router.get("/portfolios/{portfolio_id}/navigation", response_model=list[NavigationItemResponse])
def read_navigation(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> list[NavigationItem]:
    """Return the portfolio's navigation items in explicit order."""
    return list_navigation(db, portfolio=portfolio)


@router.put("/portfolios/{portfolio_id}/navigation", response_model=list[NavigationItemResponse])
def replace_portfolio_navigation(
    payload: NavigationUpdate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> list[NavigationItem]:
    """Atomically replace the portfolio's navigation items."""
    try:
        return replace_navigation(db, portfolio=portfolio, items=payload.items)
    except InvalidNavigationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
