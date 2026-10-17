"""Page management routes.

Handlers stay thin: they validate input, delegate to the service layer, and
translate domain errors into safe HTTP responses. Portfolio-scoped routes depend
on ``get_owned_portfolio`` so ownership is derived from the authenticated
session and never from client input.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_portfolio, require_csrf
from app.db.session import get_db
from app.models.page import Page
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.page import PageCreate, PageOrderUpdate, PageResponse, PageUpdate
from app.services.pages import (
    InvalidPageError,
    PageConflictError,
    create_page,
    delete_page,
    get_owned_page,
    list_pages,
    reorder_pages,
    update_page,
)

router = APIRouter(tags=["pages"])

_PAGE_NOT_FOUND = "Page not found."


def _load_owned_page(db: Session, owner: User, page_id: uuid.UUID) -> Page:
    """Return the owner's page or raise a 404 (another user's page looks absent)."""
    page = get_owned_page(db, owner=owner, page_id=page_id)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_PAGE_NOT_FOUND)
    return page


@router.get("/portfolios/{portfolio_id}/pages", response_model=list[PageResponse])
def list_portfolio_pages(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> list[Page]:
    """List the portfolio's pages in explicit order."""
    return list_pages(db, portfolio=portfolio)


@router.post(
    "/portfolios/{portfolio_id}/pages",
    response_model=PageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portfolio_page(
    payload: PageCreate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Page:
    """Create a page in the portfolio."""
    try:
        return create_page(
            db,
            portfolio=portfolio,
            title=payload.title,
            slug=payload.slug,
            is_homepage=payload.is_homepage,
            is_visible=payload.is_visible,
            seo_title=payload.seo_title,
            seo_description=payload.seo_description,
        )
    except InvalidPageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    except PageConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None


@router.put("/portfolios/{portfolio_id}/pages/order", response_model=list[PageResponse])
def reorder_portfolio_pages(
    payload: PageOrderUpdate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> list[Page]:
    """Atomically set the explicit order of the portfolio's pages."""
    try:
        return reorder_pages(db, portfolio=portfolio, page_ids=payload.page_ids)
    except InvalidPageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.get("/pages/{page_id}", response_model=PageResponse)
def read_page(
    page_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    """Retrieve one of the authenticated user's pages."""
    return _load_owned_page(db, current_user, page_id)


@router.patch("/pages/{page_id}", response_model=PageResponse)
def update_page_metadata(
    page_id: uuid.UUID,
    payload: PageUpdate,
    current_user: User = Depends(get_current_user),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Page:
    """Update one of the authenticated user's pages."""
    page = _load_owned_page(db, current_user, page_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return page
    try:
        return update_page(db, page=page, changes=changes)
    except InvalidPageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    except PageConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page_record(
    page_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Response:
    """Delete one of the authenticated user's pages."""
    page = _load_owned_page(db, current_user, page_id)
    try:
        delete_page(db, page=page)
    except PageConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
