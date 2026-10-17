"""Section engine: the typed registry of supported section types and validators."""

from app.sections.fields import SectionField, SectionValidationError, validate_fields
from app.sections.registry import (
    SECTION_TYPES,
    SectionDefinition,
    UnknownSectionTypeError,
    get_definition,
    list_definitions,
    require_definition,
)

__all__ = [
    "SECTION_TYPES",
    "SectionDefinition",
    "SectionField",
    "SectionValidationError",
    "UnknownSectionTypeError",
    "get_definition",
    "list_definitions",
    "require_definition",
    "validate_fields",
]
