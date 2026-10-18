"""Media asset business logic."""

from __future__ import annotations

import mimetypes
import os
import uuid
from pathlib import Path
from typing import IO

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.media_asset import MediaAsset
from app.models.portfolio import Portfolio
from app.models.user import User

DEFAULT_MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "media"))


def get_media_root() -> Path:
    """Return the configured storage root, reading ``MEDIA_ROOT`` at call time.

    Reading the environment here (rather than only at import) lets the test
    suite point uploads at an isolated temporary directory.
    """
    return Path(os.environ.get("MEDIA_ROOT", DEFAULT_MEDIA_ROOT))


ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Magic bytes for the raster image types we accept. Used to confirm the declared
# MIME type matches the actual file content rather than trusting the upload.
_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}


class MediaError(Exception):
    """Base class for media domain errors."""


class InvalidMediaError(MediaError):
    """Raised when media input/validation fails (HTTP 422)."""


class MediaNotFoundError(MediaError):
    """Raised when media is not found or not accessible."""


class MediaStorage:
    """Local filesystem storage for development."""

    def __init__(self, root: Path = DEFAULT_MEDIA_ROOT) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _get_portfolio_dir(self, portfolio_id: uuid.UUID) -> Path:
        portfolio_dir = self.root / str(portfolio_id)
        portfolio_dir.mkdir(parents=True, exist_ok=True)
        return portfolio_dir

    def save(self, portfolio_id: uuid.UUID, filename: str, file_obj: IO[bytes]) -> str:
        """Save file and return storage key."""
        ext = Path(filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        portfolio_dir = self._get_portfolio_dir(portfolio_id)
        dest_path = portfolio_dir / unique_name
        file_obj.seek(0)
        dest_path.write_bytes(file_obj.read())
        return f"{portfolio_id}/{unique_name}"

    def get_path(self, storage_key: str) -> Path:
        """Get full path for storage key."""
        return self.root / storage_key

    def delete(self, storage_key: str) -> None:
        try:
            path = self.get_path(storage_key)
            if path.exists():
                path.unlink()
        except Exception:
            pass


def _infer_mime_type(filename: str, content_type: str | None = None) -> str:
    if content_type and content_type.split(";")[0].strip() in ALLOWED_IMAGE_MIME_TYPES:
        return content_type.split(";")[0].strip()
    guessed = mimetypes.guess_type(filename)[0]
    if guessed in ALLOWED_IMAGE_MIME_TYPES:
        return guessed
    return content_type or "application/octet-stream"


def _get_image_dimensions(file_obj: IO[bytes]) -> tuple[int | None, int | None]:
    # For Phase 6, we store null dimensions if we can't easily read - keep simple
    try:
        from PIL import Image

        file_obj.seek(0)
        img = Image.open(file_obj)
        width, height = img.size
        img.close()
        file_obj.seek(0)
        return width, height
    except Exception:
        file_obj.seek(0)
        return None, None


def _read_head(file_obj: IO[bytes], length: int = 32) -> bytes:
    file_obj.seek(0)
    head = file_obj.read(length)
    file_obj.seek(0)
    return head


def _validate_actual_type(file_obj: IO[bytes], mime_type: str) -> None:
    """Confirm the file's leading bytes match the declared image MIME type."""
    head = _read_head(file_obj)
    if mime_type == "image/svg+xml":
        text = head.decode("utf-8", errors="ignore").lstrip()
        if not (text.startswith("<svg") or text.startswith("<?xml")):
            raise InvalidMediaError("File content does not match the declared image type.")
        return
    if mime_type == "image/webp":
        if not (head.startswith(b"RIFF") and head[8:12] == b"WEBP"):
            raise InvalidMediaError("File content does not match the declared image type.")
        return
    signatures = _MAGIC_SIGNATURES.get(mime_type, ())
    if not any(head.startswith(signature) for signature in signatures):
        raise InvalidMediaError("File content does not match the declared image type.")


def validate_upload(
    filename: str, content_type: str | None, size_bytes: int, file_obj: IO[bytes]
) -> str:
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise InvalidMediaError("File size exceeds 10 MB limit.")
    if size_bytes <= 0:
        raise InvalidMediaError("File is empty.")
    mime = _infer_mime_type(filename, content_type)
    if mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise InvalidMediaError("Only image files are allowed.")
    _validate_actual_type(file_obj, mime)
    return mime


def create_media_asset(
    db: Session,
    storage: MediaStorage,
    *,
    portfolio: Portfolio,
    user: User,
    filename: str,
    content_type: str | None,
    size_bytes: int,
    file_obj: IO[bytes],
    alt_text: str | None = None,
    caption: str | None = None,
) -> MediaAsset:
    # Ownership is enforced by portfolio belonging to user; get_owned_portfolio ensures this
    mime_type = validate_upload(filename, content_type, size_bytes, file_obj)
    width, height = _get_image_dimensions(file_obj)
    storage_key = storage.save(portfolio.id, filename, file_obj)

    asset = MediaAsset(
        portfolio_id=portfolio.id,
        storage_key=storage_key,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        width=width,
        height=height,
        alt_text=alt_text,
        caption=caption,
    )
    db.add(asset)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise InvalidMediaError("Failed to save media asset.") from None
    db.refresh(asset)
    return asset


def list_media_assets(db: Session, *, portfolio: Portfolio) -> list[MediaAsset]:
    return list(
        db.scalars(
            select(MediaAsset)
            .where(MediaAsset.portfolio_id == portfolio.id)
            .order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())
        )
    )


def get_owned_media_asset(db: Session, *, owner: User, media_id: uuid.UUID) -> MediaAsset | None:
    return db.scalar(
        select(MediaAsset)
        .join(Portfolio)
        .where(MediaAsset.id == media_id, Portfolio.owner_id == owner.id)
    )


def update_media_asset(
    db: Session, *, asset: MediaAsset, alt_text: str | None = None, caption: str | None = None
) -> MediaAsset:
    if alt_text is not None:
        asset.alt_text = alt_text
    if caption is not None:
        asset.caption = caption
    db.commit()
    db.refresh(asset)
    return asset


def delete_media_asset(db: Session, storage: MediaStorage, *, asset: MediaAsset) -> None:
    storage.delete(asset.storage_key)
    db.delete(asset)
    db.commit()
