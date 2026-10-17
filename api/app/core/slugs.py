"""Slug normalization and validation helpers.

Portfolio slugs are the public routing key (``/p/{portfolio_slug}``), so they
are unique across the whole platform and restricted to a conservative,
URL-safe character set.

The same helpers are used both to validate a client-supplied slug and to derive
a slug from a portfolio name, so the accepted format can never drift between
the two code paths.
"""

from __future__ import annotations

import re
import unicodedata

SLUG_MAX_LENGTH = 100

_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_NON_SLUG_CHARS = re.compile(r"[^a-z0-9]+")

# Platform paths and blocked names that must never be used as portfolio slugs.
RESERVED_SLUGS = frozenset(
    {
        "api",
        "auth",
        "admin",
        "dashboard",
        "health",
        "login",
        "logout",
        "register",
        "p",
        "portfolios",
        "settings",
        "static",
        "assets",
    }
)


def normalize_slug(value: str) -> str:
    """Trim surrounding whitespace and lower-case a candidate slug."""
    return value.strip().lower()


def slugify(name: str) -> str:
    """Derive a URL-safe slug from a display name.

    Accents are folded to ASCII, runs of unsupported characters collapse to a
    single hyphen, and leading/trailing hyphens are removed. Returns an empty
    string when the name contains no usable characters.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    return _NON_SLUG_CHARS.sub("-", ascii_only.lower()).strip("-")


def slug_error(slug: str, *, reserved: bool = True) -> str | None:
    """Return a human-readable validation error, or ``None`` when valid.

    ``reserved`` controls whether platform-reserved names are rejected. It is
    enabled for portfolio slugs (public routing keys under ``/p/{slug}``) but
    disabled for page slugs, which are namespaced under their portfolio and may
    legitimately reuse words like ``settings``.
    """
    if not slug:
        return "A slug is required."
    if len(slug) > SLUG_MAX_LENGTH:
        return f"Slug must be at most {SLUG_MAX_LENGTH} characters."
    if not _SLUG_PATTERN.match(slug):
        return "Slug may contain only lowercase letters, numbers, and single hyphens."
    if reserved and slug in RESERVED_SLUGS:
        return "This slug is reserved. Please choose another."
    return None
