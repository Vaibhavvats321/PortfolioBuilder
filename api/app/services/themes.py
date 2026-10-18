"""Theme and template business logic.

Every read and write is scoped to the owning portfolio here (not in the route
handlers). A portfolio has exactly one canonical theme row; it is created lazily
with registry defaults the first time it is read or written, so existing
Phase 1-4 portfolios transparently acquire a theme without a data migration.

Theme tokens and component/global-layout options are validated against the
typed registry before they are persisted. Applying a template replaces only the
design (tokens + components) and never touches pages, sections, or navigation.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.portfolio import Portfolio
from app.models.theme_config import ThemeConfig
from app.sections.fields import SectionValidationError
from app.theme.registry import (
    THEME_SCHEMA_VERSION,
    default_components,
    default_tokens,
    validate_components,
    validate_tokens,
)
from app.theme.templates import get_template


class ThemeError(Exception):
    """Base class for theme domain errors."""


class InvalidThemeError(ThemeError):
    """Raised when theme input fails validation (HTTP 422)."""


class UnknownTemplateError(ThemeError):
    """Raised when a template id is not registered (HTTP 404)."""


def _default_config() -> dict[str, object]:
    return {
        "schema_version": THEME_SCHEMA_VERSION,
        "tokens": default_tokens(),
        "components": default_components(),
    }


def get_theme(db: Session, *, portfolio: Portfolio) -> ThemeConfig:
    """Return the portfolio's theme, creating the default one if necessary."""
    config = db.scalar(select(ThemeConfig).where(ThemeConfig.portfolio_id == portfolio.id))
    if config is not None:
        return config

    config = ThemeConfig(
        portfolio_id=portfolio.id,
        config_json=_default_config(),
        schema_version=THEME_SCHEMA_VERSION,
    )
    db.add(config)
    try:
        db.commit()
    except IntegrityError:
        # Another request created the row concurrently; fall back to it.
        db.rollback()
        existing = db.scalar(select(ThemeConfig).where(ThemeConfig.portfolio_id == portfolio.id))
        if existing is None:
            raise
        return existing
    db.refresh(config)
    return config


def update_tokens(db: Session, *, portfolio: Portfolio, tokens: dict[str, object]) -> ThemeConfig:
    """Validate and persist a replacement of the portfolio's theme tokens."""
    config = get_theme(db, portfolio=portfolio)
    validated = _validate(validate_tokens, tokens)
    config.config_json = {
        **config.config_json,
        "schema_version": THEME_SCHEMA_VERSION,
        "tokens": validated,
    }
    config.schema_version = THEME_SCHEMA_VERSION
    db.commit()
    db.refresh(config)
    return config


def update_components(
    db: Session, *, portfolio: Portfolio, components: dict[str, object]
) -> ThemeConfig:
    """Validate and persist a replacement of the component/global-layout options."""
    config = get_theme(db, portfolio=portfolio)
    validated = _validate(validate_components, components)
    config.config_json = {
        **config.config_json,
        "schema_version": THEME_SCHEMA_VERSION,
        "components": validated,
    }
    config.schema_version = THEME_SCHEMA_VERSION
    db.commit()
    db.refresh(config)
    return config


def apply_template(db: Session, *, portfolio: Portfolio, template_id: str) -> ThemeConfig:
    """Replace the portfolio's design with a template's design.

    Only the theme (tokens + components) is replaced; the portfolio's pages,
    sections, and navigation are left untouched. The template is validated
    against the registry before it is stored so an invalid template can never
    corrupt a portfolio's theme.
    """
    template = get_template(template_id)
    if template is None:
        raise UnknownTemplateError("Unknown template.")

    tokens = _validate(validate_tokens, template.tokens)
    components = _validate(validate_components, template.components)

    config = get_theme(db, portfolio=portfolio)
    config.config_json = {
        "schema_version": THEME_SCHEMA_VERSION,
        "tokens": tokens,
        "components": components,
    }
    config.schema_version = THEME_SCHEMA_VERSION
    db.commit()
    db.refresh(config)
    return config


def _validate(validator, value: dict[str, object]) -> dict[str, object]:
    try:
        return validator(value)
    except SectionValidationError as exc:
        raise InvalidThemeError(str(exc)) from None
