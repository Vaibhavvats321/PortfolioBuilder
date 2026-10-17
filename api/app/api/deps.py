"""Reusable authentication dependencies and cookie helpers.

These dependencies are the single place that reads and validates the session
cookie, so route handlers (including future portfolio and page endpoints) never
duplicate session logic.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_token, tokens_match
from app.db.session import get_db
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.services.portfolios import get_owned_portfolio as _query_owned_portfolio
from app.services.sessions import get_valid_session

CSRF_HEADER_NAME = "X-CSRF-Token"


def _unauthorized() -> HTTPException:
    """A single, consistent 401 response for every authentication failure."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated.",
    )


def get_session(request: Request, db: Session = Depends(get_db)) -> AuthSession:
    """Return the valid server-side session for the request, or raise 401.

    Rejects missing, unknown, expired, and revoked sessions with a consistent
    401 so callers cannot distinguish the reason.
    """
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise _unauthorized()

    session = get_valid_session(db, raw_token)
    if session is None:
        raise _unauthorized()
    return session


def get_current_user(session: AuthSession = Depends(get_session)) -> User:
    """Return the authenticated, active user, or raise 401.

    Disabled accounts are treated as unauthenticated. Future portfolio/page
    endpoints should depend on this to obtain the owner used for authorization
    checks (never trust a client-supplied owner id).
    """
    if not session.user.is_active:
        raise _unauthorized()
    return session.user


def get_owned_portfolio(
    portfolio_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Portfolio:
    """Resolve the path portfolio when it belongs to the authenticated user.

    A portfolio owned by someone else is reported as 404 (not 403) so the API
    never confirms the existence of another user's private portfolio. Portfolio
    scoped resources depend on this to enforce ownership from the session,
    never from client-supplied owner input.
    """
    portfolio = _query_owned_portfolio(db, owner=current_user, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found.",
        )
    return portfolio


def require_csrf(
    request: Request,
    session: AuthSession = Depends(get_session),
) -> AuthSession:
    """Validate the CSRF token for a state-changing authenticated request.

    Strategy: the raw CSRF token is delivered to the browser in a non-HTTP-only
    cookie so JavaScript can echo it in the ``X-CSRF-Token`` header. The server
    requires the header to be present, to equal the cookie, and to match the
    hash bound to the authenticated session. A cross-site attacker cannot read
    the cookie value nor forge the session-bound hash.
    """
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
    """Delete the session and CSRF cookies from the browser."""
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def set_session_cookies(response: Response, *, raw_token: str, raw_csrf_token: str) -> None:
    """Attach the session and CSRF cookies to an authentication response.

    The session cookie is HTTP-only so scripts cannot read the session token.
    The CSRF cookie is deliberately readable by JavaScript (double-submit) and
    must be echoed back in the ``X-CSRF-Token`` header for state-changing
    requests. Both are ``SameSite=Lax`` and ``Secure`` outside development.
    """
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
