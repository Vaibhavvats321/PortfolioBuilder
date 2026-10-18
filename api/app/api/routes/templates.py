"""Design template routes.

Templates are engine-defined starter designs. Applying one replaces a
portfolio's theme and global-layout options in a single validated transaction
and never touches the portfolio's content.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_portfolio, require_csrf
from app.db.session import get_db
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.theme import TemplateSchema, ThemeResponse
from app.services.themes import (
    InvalidThemeError,
    UnknownTemplateError,
    apply_template,
)
from app.theme.templates import list_templates

router = APIRouter(tags=["templates"])


@router.get("/templates", response_model=list[TemplateSchema])
def list_design_templates(
    _current_user: User = Depends(get_current_user),
) -> list[TemplateSchema]:
    """List the supported design templates."""
    return [TemplateSchema.from_definition(template) for template in list_templates()]


@router.post(
    "/portfolios/{portfolio_id}/templates/{template_id}/apply",
    response_model=ThemeResponse,
)
def apply_design_template(
    template_id: str,
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """Apply a template's design to the portfolio (content is untouched)."""
    try:
        config = apply_template(db, portfolio=portfolio, template_id=template_id)
    except UnknownTemplateError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from None
    except InvalidThemeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    return ThemeResponse.from_config(config)
