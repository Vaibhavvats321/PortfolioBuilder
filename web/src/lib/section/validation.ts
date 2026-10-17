import type { SectionContent, SectionField } from "@/types/section";

/**
 * Client-side validation mirroring the backend registry validators. It gives
 * immediate feedback in the inspector; the backend remains the source of truth
 * and re-validates every write.
 *
 * Errors are keyed by a dotted path (for example `buttons.0.label`) so the
 * generic field controls can display them without knowing the section shape.
 */
export function validateSectionFields(
  fields: SectionField[],
  values: SectionContent,
  prefix = "",
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const value = values[field.name];

    if (field.kind === "repeater") {
      if (!Array.isArray(value)) {
        errors[path] = `${field.label} must be a list.`;
        continue;
      }
      if (value.length > field.max_items) {
        errors[path] =
          `${field.label} must contain at most ${field.max_items} items.`;
      }
      value.forEach((item, index) => {
        const itemValues =
          item && typeof item === "object"
            ? (item as SectionContent)
            : ({} as SectionContent);
        Object.assign(
          errors,
          validateSectionFields(field.fields, itemValues, `${path}.${index}`),
        );
      });
      continue;
    }

    const error = validateFieldValue(field, value);
    if (error) {
      errors[path] = error;
    }
  }
  return errors;
}

export function validateFieldValue(
  field: SectionField,
  value: unknown,
): string | undefined {
  if (field.kind === "text" || field.kind === "textarea") {
    if (typeof value !== "string") {
      return `${field.label} must be text.`;
    }
    const trimmed = value.trim();
    if (field.required && !trimmed) {
      return `${field.label} is required.`;
    }
    if (field.max_length != null && trimmed.length > field.max_length) {
      return `${field.label} must be at most ${field.max_length} characters.`;
    }
    return undefined;
  }

  if (field.kind === "url") {
    if (typeof value !== "string") {
      return `${field.label} must be text.`;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return field.required ? `${field.label} is required.` : undefined;
    }
    if (field.max_length != null && trimmed.length > field.max_length) {
      return `${field.label} must be at most ${field.max_length} characters.`;
    }
    return isHttpUrl(trimmed) ? undefined : "Enter a valid http or https URL.";
  }

  if (field.kind === "boolean") {
    return typeof value === "boolean"
      ? undefined
      : `${field.label} must be true or false.`;
  }

  if (field.kind === "select") {
    return typeof value === "string" && field.options.includes(value)
      ? undefined
      : `${field.label} must be one of: ${field.options.join(", ")}.`;
  }

  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
