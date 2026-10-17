"""Tests for configuration loading behavior."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

DATABASE_URL = "postgresql+psycopg://user:secret@localhost:5432/portfolio_builder"


def test_database_url_is_not_assumed_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    settings = Settings(_env_file=None)

    assert settings.database_url is None
    assert settings.is_database_configured is False


def test_database_url_loaded_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", DATABASE_URL)

    settings = Settings(_env_file=None)

    assert settings.database_url == DATABASE_URL
    assert settings.is_database_configured is True


def test_cors_origins_are_split_and_trimmed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test , ")

    settings = Settings(_env_file=None)

    assert settings.cors_origin_list == ["http://a.test", "http://b.test"]


def test_unknown_environment_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "not-a-real-environment")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_wildcard_cors_origin_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test,*")

    settings = Settings(_env_file=None)

    with pytest.raises(ValueError):
        _ = settings.cors_origin_list


def test_secure_cookies_default_by_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert Settings(_env_file=None).secure_cookies is True

    monkeypatch.setenv("ENVIRONMENT", "development")
    assert Settings(_env_file=None).secure_cookies is False


def test_secure_cookies_can_be_overridden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "false")

    assert Settings(_env_file=None).secure_cookies is False
