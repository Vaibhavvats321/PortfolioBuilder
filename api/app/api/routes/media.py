"""Media management routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_optional_current_user,
    get_owned_portfolio,
    require_csrf,
)
from app.db.session import get_db
from app.models.media_asset import MediaAsset
from app.models.portfolio import Portfolio
from app.models.session import Session as AuthSession
from app.models.user import User
from app.schemas.media import MediaResponse, MediaUpdate
from app.services.media import (
    InvalidMediaError,
    MediaError,
    MediaNotFoundError,
    MediaStorage,
    create_media_asset,
    delete_media_asset,
    get_media_root,
    get_owned_media_asset,
    get_public_media_asset,
    list_media_assets,
    update_media_asset,
)

router = APIRouter(tags=["media"])

_MEDIA_NOT_FOUND = "Media asset not found."


def get_media_storage() -> MediaStorage:
    return MediaStorage(get_media_root())


def _load_owned_media(db: Session, current_user: User, media_id: uuid.UUID) -> MediaAsset:
    asset = get_owned_media_asset(db, owner=current_user, media_id=media_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_MEDIA_NOT_FOUND)
    return asset


def _load_viewable_media(db: Session, current_user: User | None, media_id: uuid.UUID) -> MediaAsset:
    """Resolve a media file for either the owner or an anonymous site visitor.

    Signed-in callers keep the strict owner-only rule (404 when not owned).
    Anonymous callers may only read assets whose portfolio is published; every
    other asset keeps the historical 401, so draft media stays private and
    its existence is not revealed.
    """
    if current_user is not None:
        return _load_owned_media(db, current_user, media_id)
    asset = get_public_media_asset(db, media_id=media_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    return asset


@router.get("/portfolios/{portfolio_id}/media", response_model=list[MediaResponse])
def list_portfolio_media(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    db: Session = Depends(get_db),
) -> list[MediaAsset]:
    return list_media_assets(db, portfolio=portfolio)


@router.post(
    "/portfolios/{portfolio_id}/media",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_media(
    portfolio: Portfolio = Depends(get_owned_portfolio),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    alt_text: str | None = Form(default=None),
    caption: str | None = Form(default=None),
    storage: MediaStorage = Depends(get_media_storage),
) -> MediaAsset:
    try:
        return create_media_asset(
            db,
            storage,
            portfolio=portfolio,
            user=portfolio.owner,  # portfolio is owned
            filename=file.filename or "upload",
            content_type=file.content_type,
            size_bytes=file.size or 0,
            file_obj=file.file,
            alt_text=alt_text,
            caption=caption,
        )
    except InvalidMediaError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
    except MediaError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None


@router.get("/media/{media_id}", response_model=MediaResponse)
def read_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaAsset:
    return _load_owned_media(db, current_user, media_id)


@router.get("/media/{media_id}/file")
def serve_media_file(
    media_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_current_user),
    storage: MediaStorage = Depends(get_media_storage),
    db: Session = Depends(get_db),
) -> FileResponse:
    """Stream an asset's file inline for the editor, preview, and public site."""
    asset = _load_viewable_media(db, current_user, media_id)
    path = storage.get_path(asset.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_MEDIA_NOT_FOUND)
    return FileResponse(
        path,
        media_type=asset.mime_type,
        filename=asset.original_filename,
        content_disposition_type="inline",
    )


@router.patch("/media/{media_id}", response_model=MediaResponse)
def update_media(
    media_id: uuid.UUID,
    payload: MediaUpdate,
    current_user: User = Depends(get_current_user),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> MediaAsset:
    asset = _load_owned_media(db, current_user, media_id)
    try:
        return update_media_asset(
            db,
            asset=asset,
            alt_text=payload.alt_text,
            caption=payload.caption,
        )
    except MediaError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    _csrf: AuthSession = Depends(require_csrf),
    db: Session = Depends(get_db),
    storage: MediaStorage = Depends(get_media_storage),
) -> Response:
    asset = _load_owned_media(db, current_user, media_id)
    try:
        delete_media_asset(db, storage, asset=asset)
    except MediaNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
