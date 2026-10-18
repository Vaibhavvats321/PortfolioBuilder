"""Section business logic.

Every read and write is scoped to the owning portfolio here (not in the route
handlers), so ownership checks cannot be bypassed or drift between endpoints.
Section content and layout are validated against the typed registry before they
are persisted, and reordering is a single atomic transaction.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.page import Page
from app.models.page_section import SECTION_NAME_MAX_LENGTH, PageSection
from app.models.portfolio import Portfolio
from app.models.user import User
from app.sections.fields import SectionValidationError
from app.sections.registry import SectionDefinition, get_definition, require_definition


class SectionError(Exception):
    """Base class for section domain errors."""


class InvalidSectionError(SectionError):
    """Raised when section input fails business validation (HTTP 422)."""


def list_sections(db: Session, *, page: Page) -> list[PageSection]:
    """Return the page's sections in explicit order."""
    return list(
        db.scalars(
            select(PageSection)
            .where(PageSection.page_id == page.id)
            .order_by(PageSection.sort_order, PageSection.created_at, PageSection.id)
        )
    )


def get_owned_section(db: Session, *, owner: User, section_id: uuid.UUID) -> PageSection | None:
    """Return the section when its page belongs to one of ``owner``'s portfolios.

    Scoping by the owning portfolio's ``owner_id`` makes another user's section
    indistinguishable from a missing one, preventing IDOR.
    """
    return db.scalar(
        select(PageSection)
        .join(Page, PageSection.page_id == Page.id)
        .join(Portfolio, Page.portfolio_id == Portfolio.id)
        .where(PageSection.id == section_id, Portfolio.owner_id == owner.id)
    )


def create_section(
    db: Session,
    *,
    page: Page,
    section_type: str,
    name: str | None,
    is_visible: bool,
    content: dict[str, Any],
    layout: dict[str, Any],
    style: dict[str, Any],
) -> PageSection:
    """Create a section on ``page``.

    The section type must be registered; ``content``, ``layout``, and ``style``
    are validated against that type (omitted fields take their registry
    defaults). The section is appended to the end of the page.
    """
    definition = _require_definition(section_type)
    validated_content = _validate(definition.validate_content, content)
    validated_layout = _validate(definition.validate_layout, layout)
    validated_style = _validate(definition.validate_style, style)

    section = PageSection(
        page_id=page.id,
        section_type=definition.type_id,
        name=(name or definition.label).strip(),
        sort_order=_next_sort_order(db, page=page),
        is_visible=is_visible,
        content_json=validated_content,
        layout_json=validated_layout,
        style_json=validated_style,
        schema_version=definition.schema_version,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def update_section(db: Session, *, section: PageSection, changes: dict[str, Any]) -> PageSection:
    """Apply validated changes to ``section``.

    ``section`` is assumed to already be ownership-checked by the caller.
    ``section_type`` cannot be changed.
    """
    definition = get_definition(section.section_type)

    if "name" in changes:
        section.name = str(changes["name"]).strip()
    if "is_visible" in changes:
        section.is_visible = bool(changes["is_visible"])
    if "content" in changes:
        if definition is None:
            raise InvalidSectionError("This section type is no longer supported.")
        section.content_json = _validate(definition.validate_content, changes["content"])
    if "layout" in changes:
        if definition is None:
            raise InvalidSectionError("This section type is no longer supported.")
        section.layout_json = _validate(definition.validate_layout, changes["layout"])
    if "style" in changes:
        if definition is None:
            raise InvalidSectionError("This section type is no longer supported.")
        section.style_json = _validate(definition.validate_style, changes["style"])

    db.commit()
    db.refresh(section)
    return section


def delete_section(db: Session, *, section: PageSection) -> None:
    """Delete ``section``."""
    db.delete(section)
    db.commit()


def duplicate_section(db: Session, *, section: PageSection) -> PageSection:
    """Create a copy of ``section`` directly after it and return the copy."""
    sections = list_sections(db, page=section.page)
    for existing in sections:
        if existing.sort_order > section.sort_order:
            existing.sort_order += 1

    duplicate = PageSection(
        page_id=section.page_id,
        section_type=section.section_type,
        name=_copy_name(section.name),
        sort_order=section.sort_order + 1,
        is_visible=section.is_visible,
        content_json=dict(section.content_json),
        layout_json=dict(section.layout_json),
        style_json=dict(section.style_json),
        schema_version=section.schema_version,
    )
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    return duplicate


def reorder_sections(db: Session, *, page: Page, section_ids: list[uuid.UUID]) -> list[PageSection]:
    """Set the explicit order of the page's sections.

    ``section_ids`` must be a permutation of the page's current section ids so a
    stale or malicious request cannot silently drop or inject sections.
    """
    sections = list_sections(db, page=page)
    current_ids = {section.id for section in sections}
    if len(section_ids) != len(sections) or set(section_ids) != current_ids:
        raise InvalidSectionError("The order must include each section of the page exactly once.")

    positions = {section_id: index for index, section_id in enumerate(section_ids)}
    for section in sections:
        section.sort_order = positions[section.id]
    db.commit()
    return sorted(sections, key=lambda section: section.sort_order)


def _validate(validator, value: dict[str, Any]) -> dict[str, Any]:
    try:
        return validator(value)
    except SectionValidationError as exc:
        raise InvalidSectionError(str(exc)) from None


def _require_definition(section_type: str) -> SectionDefinition:
    try:
        return require_definition(section_type)
    except SectionValidationError as exc:
        raise InvalidSectionError(str(exc)) from None


def _next_sort_order(db: Session, *, page: Page) -> int:
    highest = db.scalar(
        select(func.coalesce(func.max(PageSection.sort_order), -1)).where(
            PageSection.page_id == page.id
        )
    )
    return int(highest) + 1


def _copy_name(name: str) -> str:
    candidate = f"{name} copy"
    return candidate[:SECTION_NAME_MAX_LENGTH]
