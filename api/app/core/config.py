"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]


class Settings(BaseSettings):
    """Runtime settings for the API.

    Values are read from environment variables (and an optional ``.env`` file).
    Secrets are never given defaults so that a missing ``DATABASE_URL`` is
    visible rather than silently replaced by a fallback database.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Portfolio Builder API"
    environment: Environment = "development"
    debug: bool = False
    database_url: str | None = None
    cors_origins: str = "http://localhost:3000"

    session_cookie_name: str = "pb_session"
    csrf_cookie_name: str = "pb_csrf"
    session_ttl_minutes: int = 60 * 24 * 7
    cookie_secure: bool | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the configured CORS origins as a clean list.

        A wildcard origin is rejected because credentialed requests must never
        be combined with ``*`` (see PROJECT_SPEC security requirements).
        """
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if "*" in origins:
            raise ValueError(
                "Wildcard CORS origin '*' is not allowed while credentials are enabled."
            )
        return origins

    @property
    def secure_cookies(self) -> bool:
        """Whether cookies must carry the ``Secure`` flag.

        Defaults to ``True`` outside development so production can never
        silently ship non-secure cookies. Override with ``COOKIE_SECURE``.
        """
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.environment in ("staging", "production")

    @property
    def is_database_configured(self) -> bool:
        return bool(self.database_url)


@lru_cache
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance."""
    return Settings()
