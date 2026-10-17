"""Server-side session management.

Sessions are opaque: a cryptographically random token is sent to the client in
an HTTP-only cookie and only its hash is stored. Each session also carries a
CSRF token hash that is validated for state-changing authenticated requests.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.security import CSRF_TOKEN_BYTES, generate_token, hash_token
from app.models.session import Session as AuthSession
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(UTC)


def create_session(db: Session, user: User) -> tuple[AuthSession, str, str]:
    """Create and persist a new session for ``user``.

    Returns the session along with the raw session token and raw CSRF token.
    The raw tokens are only ever returned here for cookie delivery; they are
    not persisted or logged.
    """
    settings = get_settings()
    raw_token = generate_token()
    raw_csrf_token = generate_token(CSRF_TOKEN_BYTES)
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        csrf_token_hash=hash_token(raw_csrf_token),
        expires_at=_utcnow() + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw_token, raw_csrf_token


def get_valid_session(db: Session, raw_token: str) -> AuthSession | None:
    """Return a non-revoked, non-expired session matching ``raw_token``.

    Returns ``None`` when the token is unknown, revoked, or expired. The
    associated user is eagerly loaded so callers can check account status.
    """
    session = db.scalar(
        select(AuthSession)
        .options(joinedload(AuthSession.user))
        .where(AuthSession.token_hash == hash_token(raw_token))
    )
    if session is None:
        return None
    if session.revoked_at is not None:
        return None
    if session.expires_at <= _utcnow():
        return None
    return session


def revoke_session(db: Session, session: AuthSession) -> None:
    """Revoke a session so its token can never be reused."""
    session.revoked_at = _utcnow()
    db.commit()
