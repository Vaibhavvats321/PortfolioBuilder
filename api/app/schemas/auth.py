"""Pydantic request/response schemas for authentication."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
DISPLAY_NAME_MAX_LENGTH = 120


def normalize_email(value: str) -> str:
    """Normalize an email address for storage and comparison.

    Emails are trimmed and lower-cased. This is used both for the database
    value and for every lookup so that ``A@Example.com`` and ``a@example.com``
    are treated as the same account.
    """
    return value.strip().lower()


class _EmailNormalizingModel(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _normalize(cls, value: str) -> str:
        return normalize_email(value)


class RegisterRequest(_EmailNormalizingModel):
    """Payload for creating a new account."""

    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    display_name: str = Field(min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH)

    @field_validator("display_name")
    @classmethod
    def _strip_display_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Display name must not be empty.")
        return stripped


class LoginRequest(_EmailNormalizingModel):
    """Payload for authenticating an existing account."""

    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class UserResponse(BaseModel):
    """Public representation of a user.

    Never includes the password hash, session tokens, or other secrets.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str
    is_active: bool
    created_at: datetime
