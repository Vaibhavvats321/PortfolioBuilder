"""Unauthenticated read routes for published portfolio websites.

These are the only endpoints that serve portfolio content without a session.
They resolve strictly from the active published snapshot (never draft tables)
and therefore return 404 for draft, unpublished, unknown, or corrupt sites.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.publication import PreviewResponse
from app.services.publication import get_published_site, list_published_site_summaries

router = APIRouter(prefix="/public", tags=["public"])

# The browser must never reuse a previously fetched bundle beyond the
# server-side cache window (60s TTL with immediate invalidation on
# publish/unpublish), so responses are marked non-cacheable end to end.
_CACHE_CONTROL = "no-store"


class PublishedSitePageSummary(BaseModel):
    """One page of a published site as listed in the sitemap index."""

    slug: str
    is_homepage: bool
    updated_at: datetime


class PublishedSiteSummary(BaseModel):
    """Public sitemap entry for a currently published portfolio."""

    slug: str
    published_at: datetime | None
    pages: list[PublishedSitePageSummary]


@router.get("/portfolios/{portfolio_slug}", response_model=PreviewResponse)
def read_published_site(
    portfolio_slug: str,
    response: Response,
    db: Session = Depends(get_db),
) -> PreviewResponse:
    """Serve the active published snapshot of one portfolio.

    Anonymous by design: any visitor may read a published site, and every
    non-published case (unknown slug, draft, unpublished, invalid snapshot)
    is answered with 404 so private sites are indistinguishable from missing
    ones.
    """
    site = get_published_site(db, slug=portfolio_slug)
    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found.",
        )
    response.headers["Cache-Control"] = _CACHE_CONTROL
    return site


@router.get("/sites", response_model=list[PublishedSiteSummary])
def list_published_sites(db: Session = Depends(get_db)) -> list[PublishedSiteSummary]:
    """List every currently published site (sitemap/robots discovery source).

    Draft portfolios never appear here, so crawlers only learn URLs that
    resolve to a valid published snapshot.
    """
    return [
        PublishedSiteSummary.model_validate(summary)
        for summary in list_published_site_summaries(db)
    ]
