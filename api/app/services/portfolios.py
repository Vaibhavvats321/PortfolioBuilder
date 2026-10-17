"""Portfolio business logic.

Every read and write is scoped to the authenticated owner here (not in the
route handlers) so ownership checks cannot be bypassed and cannot drift between
endpoints. Route handlers stay thin and only translate domain errors to HTTP.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.slugs import slug_error, slugify
from app.models.portfolio import Portfolio, PortfolioStatus
from app.models.user import User
from app.services.pages import create_default_pages


class PortfolioError(Exception):
    """Base class for portfolio domain errors."""


class InvalidPortfolioError(PortfolioError):
    """Raised when portfolio input fails business validation (HTTP 422)."""


class SlugConflictError(PortfolioError):
    """Raised when a slug is already used by another portfolio (HTTP 409)."""


def list_portfolios(db: Session, *, owner: User, limit: int, offset: int) -> list[Portfolio]:
    """Return the owner's portfolios, newest first."""
    return list(
        db.scalars(
            select(Portfolio)
            .where(Portfolio.owner_id == owner.id)
            .order_by(Portfolio.created_at.desc(), Portfolio.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )


def get_owned_portfolio(db: Session, *, owner: User, portfolio_id: uuid.UUID) -> Portfolio | None:
    """Return the portfolio when it exists and belongs to ``owner``, else ``None``.

    Scoping the lookup by ``owner_id`` means another user's portfolio is
    indistinguishable from a missing one, which prevents IDOR and avoids
    leaking the existence of private portfolios.
    """
    return db.scalar(
        select(Portfolio).where(
            Portfolio.id == portfolio_id,
            Portfolio.owner_id == owner.id,
        )
    )


def create_portfolio(
    db: Session,
    *,
    owner: User,
    name: str,
    slug: str | None,
    description: str | None,
) -> Portfolio:
    """Create a draft portfolio owned by ``owner``.

    When ``slug`` is ``None`` it is derived from the name; if no valid slug can
    be derived the caller must provide one explicitly. A duplicate slug raises
    ``SlugConflictError`` rather than being silently modified. Starter pages are
    seeded in the same transaction so a new portfolio is immediately editable.
    """
    if slug is None:
        derived = slugify(name)
        if slug_error(derived):
            raise InvalidPortfolioError(
                "Could not generate a valid slug from the name. Please provide a slug."
            )
        resolved_slug = derived
    else:
        resolved_slug = slug

    portfolio = Portfolio(
        owner_id=owner.id,
        name=name,
        slug=resolved_slug,
        description=description,
        status=PortfolioStatus.DRAFT.value,
        settings_json={},
    )
    db.add(portfolio)
    try:
        db.flush()
        create_default_pages(db, portfolio=portfolio)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise SlugConflictError("A portfolio with this slug already exists.") from None
    db.refresh(portfolio)
    return portfolio


def update_portfolio(
    db: Session, *, portfolio: Portfolio, changes: dict[str, str | None]
) -> Portfolio:
    """Apply validated metadata changes to ``portfolio``.

    Only the keys present in ``changes`` are modified. ``portfolio`` is assumed
    to already be ownership-checked by the caller.
    """
    if "name" in changes:
        portfolio.name = str(changes["name"])
    if "slug" in changes:
        new_slug = changes["slug"]
        if new_slug is None:
            raise InvalidPortfolioError("A slug is required.")
        error = slug_error(new_slug)
        if error:
            raise InvalidPortfolioError(error)
        portfolio.slug = new_slug
    if "description" in changes:
        portfolio.description = changes["description"]
    return _commit(db, portfolio)


def delete_portfolio(db: Session, *, portfolio: Portfolio) -> None:
    """Permanently delete ``portfolio``.

    Deletion is a hard delete; the destructive action is confirmed in the UI.
    """
    db.delete(portfolio)
    db.commit()


def _commit(db: Session, portfolio: Portfolio) -> Portfolio:
    """Commit a portfolio write, translating a unique-slug race into a conflict."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise SlugConflictError("A portfolio with this slug already exists.") from None
    db.refresh(portfolio)
    return portfolio
