"""Portfolio management routes.

All endpoints require authentication and are scoped to the authenticated user.
State-changing endpoints additionally require a valid CSRF token. Handlers stay
thin: they parse input, delegate to the service layer, and translate domain
errors into safe HTTP responses. Ownership is never taken from the client.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_portfolio, require_csrf
from app.db.session import get_db
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.portfolio import PortfolioCreate, PortfolioResponse, PortfolioUpdate
from app.schemas.publication import PreviewResponse, PublishResponse
from app.services.portfolios import (
    InvalidPortfolioError,
    SlugConflictError,
    create_portfolio,
    delete_portfolio,
    list_portfolios,
    update_portfolio,
)
from app.services.publication import (
    PublicationValidationError,
    get_draft_snapshot,
    publish_portfolio,
    unpublish_portfolio,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 100


@router.get("", response_model=list[PortfolioResponse])
def list_my_portfolios(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Portfolio]:
    """List the authenticated user's portfolios, newest first."""
    return list_portfolios(db, owner=current_user, limit=limit, offset=offset)


@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
def create_my_portfolio(
    payload: PortfolioCreate,
    current_user: User = Depends(get_current_user),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Portfolio:
    """Create a draft portfolio owned by the authenticated user."""
    try:
        return create_portfolio(
            db,
            owner=current_user,
            name=payload.name,
            slug=payload.slug,
            description=payload.description,
        )
    except InvalidPortfolioError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    except SlugConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
def read_my_portfolio(
    portfolio: Portfolio = Depends(get_owned_portfolio),
) -> Portfolio:
    """Retrieve one of the authenticated user's portfolios."""
    return portfolio


@router.patch("/{portfolio_id}", response_model=PortfolioResponse)
def update_my_portfolio(
    payload: PortfolioUpdate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Portfolio:
    """Update metadata of one of the authenticated user's portfolios."""
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return portfolio
    try:
        return update_portfolio(db, portfolio=portfolio, changes=changes)
    except InvalidPortfolioError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    except SlugConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from None


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_portfolio(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Response:
    """Delete one of the authenticated user's portfolios."""
    delete_portfolio(db, portfolio=portfolio)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{portfolio_id}/preview", response_model=PreviewResponse)
def preview_my_portfolio(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> PreviewResponse:
    """Return the live draft bundle for the owner's protected preview.

    Requires an authenticated session (ownership checked on every request)
    and never requires a CSRF token because it is a read. The consumer must
    render it behind a ``noindex`` preview page with an unmistakable draft
    banner; no published state is exposed or modified here.
    """
    return PreviewResponse.model_validate(get_draft_snapshot(db, portfolio=portfolio))


@router.post("/{portfolio_id}/publish", response_model=PublishResponse)
def publish_my_portfolio(
    current_user: User = Depends(get_current_user),
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> PublishResponse:
    """Validate and publish the owner's portfolio as one atomic operation.

    A validation failure returns 422 with every problem listed and leaves any
    previously published version active. The public path is returned only
    after the snapshot commit succeeded.
    """
    try:
        published, version = publish_portfolio(db, portfolio=portfolio, actor=current_user)
    except PublicationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    return PublishResponse(
        status=published.status,
        published_at=version.published_at,
        version_number=version.version_number,
        public_path=f"/p/{published.slug}",
    )


@router.post("/{portfolio_id}/unpublish", response_model=PortfolioResponse)
def unpublish_my_portfolio(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Portfolio:
    """Return the owner's portfolio to draft state.

    Version history is retained. Public URLs of an unpublished portfolio
    answer 404 (they must never fall back to draft content).
    """
    return unpublish_portfolio(db, portfolio=portfolio)
