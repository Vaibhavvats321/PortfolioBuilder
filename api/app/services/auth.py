"""Authentication business logic: registration and credential checks.

Route handlers stay thin and delegate here. Functions never log or return
password hashes or raw tokens.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import normalize_email


class EmailAlreadyRegisteredError(Exception):
    """Raised when a registration email is already in use."""


def register_user(db: Session, *, email: str, password: str, display_name: str) -> User:
    """Create a new active user account.

    Email uniqueness is enforced by a database constraint; an integration race
    is caught here and surfaced as ``EmailAlreadyRegisteredError`` rather than
    leaking a database error.
    """
    user = User(
        email=normalize_email(email),
        password_hash=hash_password(password),
        display_name=display_name,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise EmailAlreadyRegisteredError from None
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User | None:
    """Return the user when the credentials are valid, otherwise ``None``.

    Verifies the password even when the email is unknown is not attempted
    because there is no stored hash to compare against; callers must return a
    generic error so the response does not reveal whether the email exists.
    """
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
