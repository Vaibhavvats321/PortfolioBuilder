"""Responsive breakpoint constants and utilities shared by registry and editor."""

from __future__ import annotations

from typing import Any

from app.sections.fields import SectionValidationError, validate_partial_fields

# Responsive breakpoint identifiers used across the editor and renderer. The
# frontend mirrors this tuple in ``web/src/lib/section/responsive.ts``.
BREAKPOINTS = ("desktop", "tablet", "mobile")
DEFAULT_BREAKPOINT = "desktop"


def default_overrides() -> dict[str, Any]:
    """Return a dict mapping every breakpoint to ``None`` (inherit)."""
    return {breakpoint: None for breakpoint in BREAKPOINTS}


def validate_overrides(value: Any) -> dict[str, Any]:
    """Validate a per-breakpoint style override mapping.

    The stored shape is ``{breakpoint: <style object> | None}``. ``None`` (or a
    missing key) inherits the section's base style, while an object may contain
    any subset of the registry's responsive style fields. Unknown breakpoints
    and unknown fields are rejected so stale or malicious data cannot persist.
    """
    if value is None:
        return default_overrides()
    if not isinstance(value, dict):
        raise SectionValidationError("Responsive override must be an object.")

    unknown_breakpoints = sorted(set(value) - set(BREAKPOINTS))
    if unknown_breakpoints:
        raise SectionValidationError(
            f"Responsive override contains unknown breakpoint(s): {', '.join(unknown_breakpoints)}."
        )

    # Imported here to avoid a circular import with the registry.
    from app.sections.registry import RESPONSIVE_OVERRIDE_FIELDS

    overrides = default_overrides()
    for breakpoint in BREAKPOINTS:
        breakpoint_value = value.get(breakpoint)
        if breakpoint_value is None:
            continue
        overrides[breakpoint] = validate_partial_fields(
            RESPONSIVE_OVERRIDE_FIELDS,
            breakpoint_value,
            path=f"responsive_override.{breakpoint}",
        )
    return overrides
