"""Page business logic.

Every read and write is scoped to the owning portfolio here (not in the route
handlers), so ownership checks cannot be bypassed or drift between endpoints.
Route handlers stay thin and only translate domain errors into HTTP responses.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.slugs import slug_error, slugify
from app.models.page import Page, PageStatus
from app.models.portfolio import Portfolio
from app.models.user import User

# Starter pages seeded when a portfolio is created. They are ordinary, editable
# database records; nothing in the frontend or public runtime is hardcoded to
# these names. ``Home`` is the initial homepage.
DEFAULT_PAGES: tuple[tuple[str, str, bool], ...] = (
    ("Home", "home", True),
    ("About", "about", False),
    ("Work", "work", False),
    ("Projects", "projects", False),
    ("Contact", "contact", False),
)


class PageError(Exception):
    """Base class for page domain errors."""


class InvalidPageError(PageError):
    """Raised when page input fails business validation (HTTP 422)."""


class PageConflictError(PageError):
    """Raised when a page conflicts with an existing invariant (HTTP 409)."""


def list_pages(db: Session, *, portfolio: Portfolio) -> list[Page]:
    """Return the portfolio's pages in explicit order."""
    return list(
        db.scalars(
            select(Page)
            .where(Page.portfolio_id == portfolio.id)
            .order_by(Page.sort_order, Page.created_at, Page.id)
        )
    )


def get_owned_page(db: Session, *, owner: User, page_id: uuid.UUID) -> Page | None:
    """Return the page when it belongs to one of ``owner``'s portfolios.

    Scoping the lookup by the owning portfolio's ``owner_id`` makes another
    user's page indistinguishable from a missing one, preventing IDOR.
    """
    return db.scalar(
        select(Page)
        .join(Portfolio, Page.portfolio_id == Portfolio.id)
        .where(Page.id == page_id, Portfolio.owner_id == owner.id)
    )


def create_page(
    db: Session,
    *,
    portfolio: Portfolio,
    title: str,
    slug: str | None,
    is_homepage: bool,
    is_visible: bool,
    seo_title: str | None,
    seo_description: str | None,
) -> Page:
    """Create a page owned by ``portfolio``.

    When ``slug`` is ``None`` it is derived from the title. The first page in a
    portfolio automatically becomes the homepage; explicitly requesting the
    homepage clears any previous homepage.
    """
    resolved_slug = _resolve_slug(title=title, slug=slug)
    if is_homepage:
        _clear_homepage(db, portfolio=portfolio)
    elif not _portfolio_has_pages(db, portfolio=portfolio):
        is_homepage = True

    page = Page(
        portfolio_id=portfolio.id,
        title=title,
        slug=resolved_slug,
        is_homepage=is_homepage,
        is_visible=is_visible,
        status=PageStatus.DRAFT.value,
        sort_order=_next_sort_order(db, portfolio=portfolio),
        seo_title=seo_title,
        seo_description=seo_description,
    )
    db.add(page)
    return _commit(db, page)


def update_page(db: Session, *, page: Page, changes: dict[str, object]) -> Page:
    """Apply validated changes to ``page``.

    ``page`` is assumed to already be ownership-checked by the caller.
    """
    if "title" in changes:
        page.title = str(changes["title"])
    if "slug" in changes:
        new_slug = changes["slug"]
        if new_slug is None:
            raise InvalidPageError("A slug is required.")
        error = slug_error(str(new_slug), reserved=False)
        if error:
            raise InvalidPageError(error)
        page.slug = str(new_slug)
    if "is_visible" in changes:
        page.is_visible = bool(changes["is_visible"])
    if "seo_title" in changes:
        seo_title = changes["seo_title"]
        page.seo_title = None if seo_title is None else str(seo_title)
    if "seo_description" in changes:
        seo_description = changes["seo_description"]
        page.seo_description = None if seo_description is None else str(seo_description)
    if "is_homepage" in changes:
        _apply_homepage_change(db, page=page, is_homepage=bool(changes["is_homepage"]))
    return _commit(db, page)


def delete_page(db: Session, *, page: Page) -> None:
    """Delete ``page``. The homepage cannot be deleted directly."""
    if page.is_homepage:
        raise PageConflictError(
            "The homepage cannot be deleted. Assign another page as the homepage first."
        )
    db.delete(page)
    db.commit()


def reorder_pages(db: Session, *, portfolio: Portfolio, page_ids: list[uuid.UUID]) -> list[Page]:
    """Set the explicit order of the portfolio's pages.

    ``page_ids`` must be a permutation of the portfolio's current page ids so a
    stale or malicious request cannot silently drop or inject pages.
    """
    pages = list_pages(db, portfolio=portfolio)
    current_ids = {page.id for page in pages}
    if len(page_ids) != len(pages) or set(page_ids) != current_ids:
        raise InvalidPageError("The order must include each page of the portfolio exactly once.")

    positions = {page_id: index for index, page_id in enumerate(page_ids)}
    for page in pages:
        page.sort_order = positions[page.id]
    db.commit()
    return sorted(pages, key=lambda page: page.sort_order)


def create_default_pages(db: Session, *, portfolio: Portfolio) -> list[Page]:
    """Add the starter pages to a newly created portfolio (no commit).

    The caller owns the transaction so portfolio creation and starter pages are
    persisted atomically.
    """
    pages = [
        Page(
            portfolio_id=portfolio.id,
            title=title,
            slug=slug,
            is_homepage=is_homepage,
            is_visible=True,
            status=PageStatus.DRAFT.value,
            sort_order=index,
        )
        for index, (title, slug, is_homepage) in enumerate(DEFAULT_PAGES)
    ]
    db.add_all(pages)
    return pages


def _resolve_slug(*, title: str, slug: str | None) -> str:
    if slug is not None:
        return slug
    derived = slugify(title)
    if slug_error(derived, reserved=False):
        raise InvalidPageError(
            "Could not generate a valid slug from the title. Please provide a slug."
        )
    return derived


def _portfolio_has_pages(db: Session, *, portfolio: Portfolio) -> bool:
    count = db.scalar(
        select(func.count()).select_from(Page).where(Page.portfolio_id == portfolio.id)
    )
    return bool(count)


def _next_sort_order(db: Session, *, portfolio: Portfolio) -> int:
    highest = db.scalar(
        select(func.coalesce(func.max(Page.sort_order), -1)).where(
            Page.portfolio_id == portfolio.id
        )
    )
    return int(highest) + 1


def _clear_homepage(db: Session, *, portfolio: Portfolio) -> None:
    db.execute(
        update(Page)
        .where(Page.portfolio_id == portfolio.id, Page.is_homepage.is_(True))
        .values(is_homepage=False)
    )


def _apply_homepage_change(db: Session, *, page: Page, is_homepage: bool) -> None:
    if is_homepage:
        db.execute(
            update(Page)
            .where(
                Page.portfolio_id == page.portfolio_id,
                Page.is_homepage.is_(True),
                Page.id != page.id,
            )
            .values(is_homepage=False)
        )
        page.is_homepage = True
        return
    if page.is_homepage:
        raise PageConflictError(
            "The homepage cannot be unset. Assign another page as the homepage first."
        )


def _commit(db: Session, page: Page) -> Page:
    """Commit a page write, translating constraint races into a conflict."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise PageConflictError("A page with this slug already exists in this portfolio.") from None
    db.refresh(page)
    return page
