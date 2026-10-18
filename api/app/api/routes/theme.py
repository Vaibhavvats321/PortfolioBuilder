"""Theme and global-layout routes.

Handlers stay thin: they validate input, delegate to the service layer, and
translate domain errors into safe HTTP responses. Portfolio-scoped routes depend
on ``get_owned_portfolio`` so ownership is derived from the authenticated
session and never from client input.

``/theme`` manages the global design tokens; ``/global-layout`` manages the
site chrome (header, footer, sidebar, branding, social). Both slices live in
the same canonical ``theme_configs`` row, so each endpoint reads or replaces
only its own slice.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_portfolio, require_csrf
from app.db.session import get_db
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.theme import (
    GlobalLayoutResponse,
    GlobalLayoutUpdate,
    ThemeGroupSchema,
    ThemeOptionsResponse,
    ThemeResponse,
    ThemeUpdate,
)
from app.services.themes import InvalidThemeError, get_theme, update_components, update_tokens
from app.theme.registry import (
    LAYOUT_GROUPS,
    THEME_SCHEMA_VERSION,
    TOKEN_GROUPS,
    default_components,
    default_tokens,
)

router = APIRouter(tags=["theme"])


@router.get("/theme/options", response_model=ThemeOptionsResponse)
def read_theme_options(
    _current_user: User = Depends(get_current_user),
) -> ThemeOptionsResponse:
    """List the design groups, fields, and defaults that drive the editor."""
    return ThemeOptionsResponse(
        schema_version=THEME_SCHEMA_VERSION,
        token_groups=[ThemeGroupSchema.from_group(group) for group in TOKEN_GROUPS],
        layout_groups=[ThemeGroupSchema.from_group(group) for group in LAYOUT_GROUPS],
        default_tokens=default_tokens(),
        default_components=default_components(),
    )


@router.get("/portfolios/{portfolio_id}/theme", response_model=ThemeResponse)
def read_theme(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """Return the portfolio's theme tokens and global-layout options."""
    return ThemeResponse.from_config(get_theme(db, portfolio=portfolio))


@router.put("/portfolios/{portfolio_id}/theme", response_model=ThemeResponse)
def replace_theme(
    payload: ThemeUpdate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """Replace the portfolio's global design tokens."""
    try:
        config = update_tokens(db, portfolio=portfolio, tokens=payload.tokens)
    except InvalidThemeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    return ThemeResponse.from_config(config)


@router.get("/portfolios/{portfolio_id}/global-layout", response_model=GlobalLayoutResponse)
def read_global_layout(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> GlobalLayoutResponse:
    """Return the portfolio's component/global-layout options."""
    return GlobalLayoutResponse.from_config(get_theme(db, portfolio=portfolio))


@router.put("/portfolios/{portfolio_id}/global-layout", response_model=GlobalLayoutResponse)
def replace_global_layout(
    payload: GlobalLayoutUpdate,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> GlobalLayoutResponse:
    """Replace the portfolio's component/global-layout options."""
    try:
        config = update_components(db, portfolio=portfolio, components=payload.components)
    except InvalidThemeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    return GlobalLayoutResponse.from_config(config)
