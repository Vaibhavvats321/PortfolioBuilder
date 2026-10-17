"""Generic field descriptors and validation for the section registry.

A section type declares its content and layout as an ordered list of
:class:`SectionField` descriptors. The same descriptors are used to fill
defaults, validate untrusted input on the backend, and drive the visual editor
controls on the frontend (exposed through ``GET /section-types``). Keeping a
single source of truth avoids the classic drift between a schema, its defaults,
and its editor UI.

Validation is deliberately allowlist-based: unknown keys are rejected, values
must match the declared kind, text is length-bounded, URLs must be http(s), and
repeater lists are capped. Nothing here executes or accepts markup.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

URL_MAX_LENGTH = 2048

FieldKind = Literal["text", "textarea", "url", "boolean", "select", "repeater"]


class SectionValidationError(ValueError):
    """Raised when a content or layout value fails validation (HTTP 422)."""


@dataclass(frozen=True)
class SectionField:
    """Declarative description of one editable section field.

    ``required`` marks a field that must not be blank *when it is submitted*;
    omitted fields simply fall back to their default so a section can be created
    before the owner has filled everything in.
    """

    name: str
    kind: FieldKind
    label: str
    required: bool = False
    max_length: int | None = None
    options: tuple[str, ...] = ()
    default: Any = None
    placeholder: str | None = None
    help_text: str | None = None
    item_label: str | None = None
    max_items: int = 50
    fields: tuple[SectionField, ...] = ()


def default_value(field_spec: SectionField) -> Any:
    """Return the default value stored when a field is omitted."""
    if field_spec.kind == "repeater":
        return []
    if field_spec.kind == "boolean":
        return bool(field_spec.default) if field_spec.default is not None else False
    if field_spec.kind == "select":
        if field_spec.default in field_spec.options:
            return field_spec.default
        return field_spec.options[0] if field_spec.options else ""
    if field_spec.kind == "url" or field_spec.kind in ("text", "textarea"):
        return field_spec.default if isinstance(field_spec.default, str) else ""
    return field_spec.default


def default_fields(fields: tuple[SectionField, ...]) -> dict[str, Any]:
    """Build a default mapping for ``fields``."""
    return {field_spec.name: default_value(field_spec) for field_spec in fields}


def validate_fields(
    fields: tuple[SectionField, ...], values: dict[str, Any], *, path: str
) -> dict[str, Any]:
    """Validate ``values`` against ``fields`` and return a normalized mapping.

    Unknown keys are rejected so untrusted or stale content cannot smuggle data
    into the stored JSON. Missing keys are filled with their defaults.
    """
    if not isinstance(values, dict):
        raise SectionValidationError(f"{path} must be an object.")

    known = {field_spec.name for field_spec in fields}
    unknown = sorted(set(values) - known)
    if unknown:
        raise SectionValidationError(f"{path} contains unknown field(s): {', '.join(unknown)}.")

    result: dict[str, Any] = {}
    for field_spec in fields:
        if field_spec.name in values:
            result[field_spec.name] = _validate_value(
                field_spec, values[field_spec.name], path=f"{path}.{field_spec.name}"
            )
        else:
            result[field_spec.name] = default_value(field_spec)
    return result


def _validate_value(field_spec: SectionField, value: Any, *, path: str) -> Any:
    if field_spec.kind in ("text", "textarea"):
        return _validate_text(field_spec, value, path=path)
    if field_spec.kind == "url":
        return _validate_url(field_spec, value, path=path)
    if field_spec.kind == "boolean":
        if not isinstance(value, bool):
            raise SectionValidationError(f"{path} must be true or false.")
        return value
    if field_spec.kind == "select":
        if not isinstance(value, str) or value not in field_spec.options:
            allowed = ", ".join(field_spec.options)
            raise SectionValidationError(f"{path} must be one of: {allowed}.")
        return value
    if field_spec.kind == "repeater":
        return _validate_repeater(field_spec, value, path=path)
    raise SectionValidationError(f"{path} has an unsupported field kind.")


def _validate_text(field_spec: SectionField, value: Any, *, path: str) -> str:
    if not isinstance(value, str):
        raise SectionValidationError(f"{path} must be text.")
    stripped = value.strip()
    if field_spec.required and not stripped:
        raise SectionValidationError(f"{path} is required.")
    if field_spec.max_length is not None and len(stripped) > field_spec.max_length:
        raise SectionValidationError(f"{path} must be at most {field_spec.max_length} characters.")
    return stripped


def _validate_url(field_spec: SectionField, value: Any, *, path: str) -> str:
    if not isinstance(value, str):
        raise SectionValidationError(f"{path} must be text.")
    stripped = value.strip()
    if not stripped:
        if field_spec.required:
            raise SectionValidationError(f"{path} is required.")
        return ""
    if field_spec.max_length is not None and len(stripped) > field_spec.max_length:
        raise SectionValidationError(f"{path} must be at most {field_spec.max_length} characters.")
    parsed = urlparse(stripped)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise SectionValidationError(f"{path} must be a valid http or https URL.")
    return stripped


def _validate_repeater(field_spec: SectionField, value: Any, *, path: str) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise SectionValidationError(f"{path} must be a list.")
    if len(value) > field_spec.max_items:
        raise SectionValidationError(f"{path} must contain at most {field_spec.max_items} items.")
    items: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        items.append(validate_fields(field_spec.fields, item, path=f"{path}[{index}]"))
    return items
