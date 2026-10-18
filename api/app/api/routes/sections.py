"""Section management routes.

Handlers stay thin: they validate input, delegate to the service layer, and
translate domain errors into safe HTTP responses. Page-scoped routes depend on
``get_owned_page`` and section routes on ``get_owned_section`` so ownership is
derived from the authenticated session and never from client input.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_owned_page,
    get_owned_section,
    require_csrf,
)
from app.db.session import get_db
from app.models.page import Page
from app.models.page_section import PageSection
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.section import (
    SectionCreate,
    SectionOrderUpdate,
    SectionResponse,
    SectionTypeSchema,
    SectionUpdate,
)
from app.sections.registry import list_definitions
from app.services.sections import (
    InvalidSectionError,
    create_section,
    delete_section,
    duplicate_section,
    list_sections,
    reorder_sections,
    update_section,
)

router = APIRouter(tags=["sections"])


@router.get("/section-types", response_model=list[SectionTypeSchema])
def list_section_types(
    _current_user: User = Depends(get_current_user),
) -> list[SectionTypeSchema]:
    """List the supported section types and their editable fields."""
    return [SectionTypeSchema.from_definition(definition) for definition in list_definitions()]


@router.get("/pages/{page_id}/sections", response_model=list[SectionResponse])
def list_page_sections(
    page: Page = Depends(get_owned_page),
    db: Session = Depends(get_db),
) -> list[PageSection]:
    """List the page's sections in explicit order."""
    return list_sections(db, page=page)


@router.post(
    "/pages/{page_id}/sections",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_page_section(
    payload: SectionCreate,
    page: Page = Depends(get_owned_page),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> PageSection:
    """Add a section to the page."""
    try:
        return create_section(
            db,
            page=page,
            section_type=payload.section_type,
            name=payload.name,
            is_visible=payload.is_visible,
            content=payload.content,
            layout=payload.layout,
            style=payload.style,
        )
    except InvalidSectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.put("/pages/{page_id}/sections/order", response_model=list[SectionResponse])
def reorder_page_sections(
    payload: SectionOrderUpdate,
    page: Page = Depends(get_owned_page),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> list[PageSection]:
    """Atomically set the explicit order of the page's sections."""
    try:
        return reorder_sections(db, page=page, section_ids=payload.section_ids)
    except InvalidSectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.get("/sections/{section_id}", response_model=SectionResponse)
def read_section(section: PageSection = Depends(get_owned_section)) -> PageSection:
    """Retrieve one of the authenticated user's sections."""
    return section


@router.patch("/sections/{section_id}", response_model=SectionResponse)
def update_page_section(
    payload: SectionUpdate,
    section: PageSection = Depends(get_owned_section),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> PageSection:
    """Update one of the authenticated user's sections."""
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return section
    try:
        return update_section(db, section=section, changes=changes)
    except InvalidSectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.post(
    "/sections/{section_id}/duplicate",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_page_section(
    section: PageSection = Depends(get_owned_section),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> PageSection:
    """Duplicate a section directly after the original."""
    return duplicate_section(db, section=section)


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page_section(
    section: PageSection = Depends(get_owned_section),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Response:
    """Delete one of the authenticated user's sections."""
    delete_section(db, section=section)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
