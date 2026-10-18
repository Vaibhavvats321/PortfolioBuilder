"""Publication business logic: validation, snapshots, publish, unpublish.

Publication is portfolio-level and deliberately separate from draft editing:

- Draft edits (pages, sections, navigation, theme, media) live in their own
  tables and never touch ``portfolio_versions``.
- Publishing validates the whole draft, builds an immutable snapshot, inserts
  it as the next ``portfolio_versions`` row, and repoints
  ``portfolios.current_published_version_id`` — all in **one transaction**, so a
  failure at any step leaves the previous published version active.
- Unpublishing flips the status back to ``draft`` and clears ``published_at``
  but keeps the version history; the public resolver must gate on
  ``status == "published"`` (unpublished URLs return **404**, never draft data).
- Snapshots are never updated after creation; republishing appends a new row.

The snapshot and the draft preview are built by the same ``build_snapshot``
function so preview and published rendering consume identical shapes.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.slugs import slug_error
from app.models.navigation import NavigationDestinationType
from app.models.page_section import PageSection
from app.models.portfolio import Portfolio, PortfolioStatus
from app.models.portfolio_version import SNAPSHOT_SCHEMA_VERSION, PortfolioVersion
from app.models.theme_config import ThemeConfig
from app.models.user import User
from app.sections.fields import SectionValidationError
from app.sections.registry import get_definition
from app.services.media import list_media_assets
from app.services.navigation import list_navigation
from app.services.pages import list_pages
from app.services.sections import list_sections
from app.theme.registry import (
    THEME_SCHEMA_VERSION,
    default_components,
    default_tokens,
    validate_components,
    validate_tokens,
)


class PublicationError(Exception):
    """Base class for publication domain errors."""


class PublicationValidationError(PublicationError):
    """Raised when the draft is not publishable (HTTP 422).

    Carries every problem found so the UI can show them all at once instead of
    making the user fix them one at a time.
    """

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


def media_file_path(media_id: uuid.UUID) -> str:
    """Return the stable relative URL that serves a media asset's bytes."""
    return f"/media/{media_id}/file"


def _json_default(value: Any) -> str:
    """Serialize snapshot leaf types that ``json`` cannot handle natively."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable.")


def _jsonable(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Round-trip a snapshot through JSON so ids/timestamps are strings.

    JSONB cannot store UUID or datetime objects; string ids also match what
    every API response serializes, so snapshots and responses stay consistent.
    """
    return json.loads(json.dumps(snapshot, default=_json_default))


def _theme_payload(db: Session, *, portfolio: Portfolio) -> dict[str, Any]:
    """Return the canonical theme (tokens + components) for ``portfolio``.

    Unlike ``get_theme`` this never creates or commits a theme row: publishing
    must not write anything (or release its row lock) before validation has
    passed. A portfolio that never touched the Design Studio simply gets
    registry defaults in the payload.
    """
    config = db.scalar(select(ThemeConfig).where(ThemeConfig.portfolio_id == portfolio.id))
    if config is None:
        return {
            "schema_version": THEME_SCHEMA_VERSION,
            "tokens": default_tokens(),
            "components": default_components(),
        }
    raw = config.config_json if isinstance(config.config_json, dict) else {}
    tokens = raw.get("tokens")
    components = raw.get("components")
    return {
        "schema_version": config.schema_version,
        "tokens": tokens if isinstance(tokens, dict) else {},
        "components": components if isinstance(components, dict) else {},
    }


def build_snapshot(db: Session, *, portfolio: Portfolio) -> dict[str, Any]:
    """Build the renderable configuration bundle for ``portfolio``.

    This single builder serves both the publication snapshot and the draft
    preview endpoint, guaranteeing preview and published rendering see the
    same data shape. It only reads draft tables.
    """
    pages = list_pages(db, portfolio=portfolio)
    navigation = list_navigation(db, portfolio=portfolio)
    theme = _theme_payload(db, portfolio=portfolio)
    media = list_media_assets(db, portfolio=portfolio)

    page_payloads: list[dict[str, Any]] = []
    for page in pages:
        sections = list_sections(db, page=page)
        page_payloads.append(
            {
                "id": page.id,
                "title": page.title,
                "slug": page.slug,
                "is_homepage": page.is_homepage,
                "is_visible": page.is_visible,
                "sort_order": page.sort_order,
                "seo_title": page.seo_title,
                "seo_description": page.seo_description,
                "created_at": page.created_at,
                "updated_at": page.updated_at,
                "sections": [
                    {
                        "id": section.id,
                        "page_id": section.page_id,
                        "section_type": section.section_type,
                        "name": section.name,
                        "sort_order": section.sort_order,
                        "is_visible": section.is_visible,
                        "content": dict(section.content_json),
                        "layout": dict(section.layout_json),
                        "style": dict(section.style_json),
                        "schema_version": section.schema_version,
                        "created_at": section.created_at,
                        "updated_at": section.updated_at,
                    }
                    for section in sections
                ],
            }
        )

    return {
        "snapshot_version": SNAPSHOT_SCHEMA_VERSION,
        "portfolio": {
            "id": portfolio.id,
            "name": portfolio.name,
            "slug": portfolio.slug,
            "description": portfolio.description,
            "settings": dict(portfolio.settings_json),
        },
        "pages": page_payloads,
        "navigation": [
            {
                "id": item.id,
                "location": item.location,
                "label": item.label,
                "destination_type": item.destination_type,
                "page_id": item.page_id,
                "external_url": item.external_url,
                "sort_order": item.sort_order,
                "is_visible": item.is_visible,
            }
            for item in navigation
        ],
        "theme": theme,
        "media": [
            {
                "id": asset.id,
                "original_filename": asset.original_filename,
                "mime_type": asset.mime_type,
                "width": asset.width,
                "height": asset.height,
                "alt_text": asset.alt_text,
                "caption": asset.caption,
                "url": media_file_path(asset.id),
            }
            for asset in media
        ],
    }


def collect_publication_errors(db: Session, *, portfolio: Portfolio) -> list[str]:
    """Return every reason the draft cannot be published (empty = publishable).

    Checks cover the spec's publication validation set: slugs, the homepage,
    navigation destinations, section schemas, the theme schema, and required
    configuration. Database rows are treated as potentially invalid until
    re-validated here, so corrupt data cannot reach a snapshot.
    """
    errors: list[str] = []

    if not portfolio.name.strip():
        errors.append("Portfolio name must not be empty.")
    slug_problem = slug_error(portfolio.slug)
    if slug_problem:
        errors.append(f"Portfolio slug is invalid: {slug_problem}")

    pages = list_pages(db, portfolio=portfolio)
    if not pages:
        errors.append("At least one page is required before publishing.")
    homepages = [page for page in pages if page.is_homepage]
    if pages and not homepages:
        errors.append("Exactly one homepage page is required before publishing.")
    if len(homepages) > 1:
        errors.append("More than one homepage is set; exactly one is required.")

    page_ids = {page.id for page in pages}
    for page in pages:
        if not page.title.strip():
            errors.append("Every page must have a title.")
        page_slug_problem = slug_error(page.slug)
        if page_slug_problem:
            errors.append(f'Page "{page.title}": invalid slug ({page_slug_problem}).')

    for item in list_navigation(db, portfolio=portfolio):
        if item.destination_type == NavigationDestinationType.PAGE:
            if item.page_id is None or item.page_id not in page_ids:
                errors.append(f'Navigation item "{item.label}" points at a missing page.')
        elif item.destination_type == NavigationDestinationType.EXTERNAL_URL:
            parsed = urlparse(item.external_url or "")
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                errors.append(f'Navigation item "{item.label}" has an invalid external URL.')

    for page in pages:
        for section in list_sections(db, page=page):
            errors.extend(_section_errors(page_title=page.title, section=section))

    theme = _theme_payload(db, portfolio=portfolio)
    for label, validator, value in (
        ("theme tokens", validate_tokens, theme["tokens"]),
        ("global layout", validate_components, theme["components"]),
    ):
        try:
            validator(value)
        except SectionValidationError as exc:
            errors.append(f"Invalid {label}: {exc}.")

    return errors


def _section_errors(*, page_title: str, section: PageSection) -> list[str]:
    """Re-validate one section row against its registered type.

    Beyond the schema rules applied on every write, publication additionally
    enforces completeness: a required field left empty (the write path fills
    omitted required fields with their empty defaults so drafts can be
    partially completed) would render as blank published content, so it is
    rejected here instead of being snapshotted.
    """
    definition = get_definition(section.section_type)
    if definition is None:
        return [
            f'Page "{page_title}" section "{section.name}": '
            f"section type {section.section_type} is not supported."
        ]

    problems: list[str] = []
    for label, validator, fields, value in (
        (
            "content",
            definition.validate_content,
            definition.content_fields,
            dict(section.content_json),
        ),
        ("layout", definition.validate_layout, definition.layout_fields, dict(section.layout_json)),
        ("style", definition.validate_style, definition.style_fields, dict(section.style_json)),
    ):
        try:
            validated = validator(value)
        except SectionValidationError as exc:
            problems.append(
                f'Page "{page_title}" section "{section.name}": invalid {label} ({exc}).'
            )
            continue
        for field_spec in fields:
            if not field_spec.required:
                continue
            stored = validated.get(field_spec.name)
            empty = (isinstance(stored, str) and not stored.strip()) or (
                isinstance(stored, list) and not stored
            )
            if empty:
                problems.append(
                    f'Page "{page_title}" section "{section.name}": '
                    f"{label}.{field_spec.name} is required."
                )
    return problems


def publish_portfolio(
    db: Session, *, portfolio: Portfolio, actor: User
) -> tuple[Portfolio, PortfolioVersion]:
    """Validate and publish ``portfolio`` atomically.

    The portfolio row is locked (``SELECT ... FOR UPDATE``) so concurrent
    publish requests serialize and each one observes a consistent draft. The
    snapshot insert and the status/pointer flip share one commit: any failure
    rolls everything back and leaves the previously published version active.
    """
    # Lock the portfolio row for the duration of the transaction.
    db.execute(select(Portfolio.id).where(Portfolio.id == portfolio.id).with_for_update())

    errors = collect_publication_errors(db, portfolio=portfolio)
    if errors:
        raise PublicationValidationError(errors)

    snapshot = build_snapshot(db, portfolio=portfolio)

    next_number = (
        int(
            db.scalar(
                select(func.coalesce(func.max(PortfolioVersion.version_number), 0)).where(
                    PortfolioVersion.portfolio_id == portfolio.id
                )
            )
            or 0
        )
        + 1
    )

    version = PortfolioVersion(
        portfolio_id=portfolio.id,
        version_number=next_number,
        snapshot_json=_jsonable(snapshot),
        published_by=actor.id,
        published_at=datetime.now(UTC),
    )
    db.add(version)
    db.flush()

    portfolio.status = PortfolioStatus.PUBLISHED.value
    portfolio.published_at = version.published_at
    portfolio.current_published_version_id = version.id
    db.commit()
    db.refresh(portfolio)
    db.refresh(version)
    return portfolio, version


def unpublish_portfolio(db: Session, *, portfolio: Portfolio) -> Portfolio:
    """Flip ``portfolio`` back to draft.

    Version history (including ``current_published_version_id``) is retained
    for future restore features; only the active flag and timestamp change.
    The public resolver must gate on ``status``, so an unpublished portfolio
    serves 404 and can never fall back to draft content.
    """
    if portfolio.status == PortfolioStatus.DRAFT.value:
        return portfolio
    portfolio.status = PortfolioStatus.DRAFT.value
    portfolio.published_at = None
    db.commit()
    db.refresh(portfolio)
    return portfolio


def get_draft_snapshot(db: Session, *, portfolio: Portfolio) -> dict[str, Any]:
    """Return the live draft bundle for the authenticated preview endpoint.

    Always reads current draft tables (not the last snapshot), so the preview
    reflects unsaved-to-publish changes immediately. Live publication state is
    merged in for display only — snapshots themselves never embed the status
    they were created with.
    """
    bundle = build_snapshot(db, portfolio=portfolio)
    bundle["portfolio"]["status"] = portfolio.status
    bundle["portfolio"]["published_at"] = portfolio.published_at
    return bundle


def list_versions(db: Session, *, portfolio: Portfolio) -> list[PortfolioVersion]:
    """Return the portfolio's publication history, oldest first."""
    return list(
        db.scalars(
            select(PortfolioVersion)
            .where(PortfolioVersion.portfolio_id == portfolio.id)
            .order_by(PortfolioVersion.version_number)
        )
    )
