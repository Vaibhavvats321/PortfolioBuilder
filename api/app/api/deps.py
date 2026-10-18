"""Reusable authentication dependencies and cookie helpers."""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_token, tokens_match
from app.db.session import get_db
from app.models.media_asset import MediaAsset
from app.models.page import Page
from app.models.page_section import PageSection
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.services.media import get_owned_media_asset as _query_owned_media
from app.services.pages import get_owned_page as _query_owned_page
from app.services.portfolios import get_owned_portfolio as _query_owned_portfolio
from app.services.sections import get_owned_section as _query_owned_section
from app.services.sessions import get_valid_session

CSRF_HEADER_NAME = "X-CSRF-Token"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
    )


def get_session(request: Request, db: Session = Depends(get_db)) -> AuthSession:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise _unauthorized()

    session = get_valid_session(db, raw_token)
    if session is None:
        raise _unauthorized()
    return session


def get_current_user(session: AuthSession = Depends(get_session)) -> User:
    if not session.user.is_active:
        raise _unauthorized()
    return session.user


def get_owned_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Portfolio:
    portfolio = _query_owned_portfolio(db, owner=current_user, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found.",
        )
    return portfolio


def get_owned_page(
    page_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page:
    page = _query_owned_page(db, owner=current_user, page_id=page_id)
    if page is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found.",
        )
    return page


def get_owned_section(
    section_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PageSection:
    section = _query_owned_section(db, owner=current_user, section_id=section_id)
    if section is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found.",
        )
    return section


def get_owned_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaAsset:
    asset = _query_owned_media(db, owner=current_user, media_id=media_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media asset not found.",
        )
    return asset


def require_csrf(
    request: Request,
    session: AuthSession = Depends(get_session),
) -> AuthSession:
    settings = get_settings()
    header_token = request.headers.get(CSRF_HEADER_NAME)
    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    if not header_token or not cookie_token:
        raise _csrf_failed()
    if not tokens_match(header_token, cookie_token):
        raise _csrf_failed()
    if not tokens_match(hash_token(header_token), session.csrf_token_hash):
        raise _csrf_failed()
    return session


def _csrf_failed() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="CSRF validation failed.",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def set_session_cookies(response: Response, *, raw_token: str, raw_csrf_token: str) -> None:
    settings = get_settings()
    max_age = settings.session_ttl_minutes * 60
    secure = settings.secure_cookies

    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=raw_csrf_token,
        max_age=max_age,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )
