"""Media schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MediaCreate(BaseModel):
    """Payload for updating media metadata on upload."""

    alt_text: str | None = Field(default=None, max_length=255)
    caption: str | None = Field(default=None, max_length=500)


class MediaUpdate(BaseModel):
    """Payload for updating media metadata."""

    alt_text: str | None = Field(default=None, max_length=255)
    caption: str | None = Field(default=None, max_length=500)


class MediaResponse(BaseModel):
    """Media asset metadata returned to the API consumer."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    portfolio_id: uuid.UUID
    storage_key: str
    original_filename: str
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None
    alt_text: str | None
    caption: str | None
    created_at: datetime
    updated_at: datetime
