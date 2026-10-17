"""Pydantic request/response schemas for portfolio navigation."""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.navigation import (
    EXTERNAL_URL_MAX_LENGTH,
    LABEL_MAX_LENGTH,
    NavigationDestinationType,
    NavigationLocation,
)

MAX_NAVIGATION_ITEMS = 200


def validate_external_url(value: str) -> str:
    """Validate and return an http(s) URL, raising ``ValueError`` otherwise."""
    stripped = value.strip()
    parsed = urlparse(stripped)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("External URL must be a valid http or https URL.")
    return stripped


class NavigationItemInput(BaseModel):
    """One navigation item in a replace-navigation request."""

    location: NavigationLocation
    label: str = Field(min_length=1, max_length=LABEL_MAX_LENGTH)
    destination_type: NavigationDestinationType
    page_id: uuid.UUID | None = None
    external_url: str | None = Field(default=None, max_length=EXTERNAL_URL_MAX_LENGTH)
    is_visible: bool = True

    @field_validator("label")
    @classmethod
    def _check_label(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Label must not be empty.")
        return stripped

    @field_validator("external_url")
    @classmethod
    def _check_external_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_external_url(value)

    @model_validator(mode="after")
    def _check_destination_consistency(self) -> NavigationItemInput:
        if self.destination_type == NavigationDestinationType.PAGE:
            if self.page_id is None:
                raise ValueError("A page destination requires page_id.")
            if self.external_url is not None:
                raise ValueError("A page destination must not include external_url.")
        else:
            if self.page_id is not None:
                raise ValueError("An external URL destination must not include page_id.")
            if self.external_url is None:
                raise ValueError("An external URL destination requires external_url.")
        return self


class NavigationUpdate(BaseModel):
    """Payload that atomically replaces a portfolio's navigation items.

    The order of ``items`` defines the persisted ordering.
    """

    items: list[NavigationItemInput] = Field(default_factory=list, max_length=MAX_NAVIGATION_ITEMS)


class NavigationItemResponse(BaseModel):
    """Public representation of a navigation item."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    portfolio_id: uuid.UUID
    location: NavigationLocation
    label: str
    destination_type: NavigationDestinationType
    page_id: uuid.UUID | None
    external_url: str | None
    sort_order: int
    is_visible: bool
