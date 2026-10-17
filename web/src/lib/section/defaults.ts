import type { SectionContent, SectionField } from "@/types/section";

/** Compute the default value for a field, mirroring the backend registry. */
export function defaultForField(field: SectionField): unknown {
  switch (field.kind) {
    case "repeater":
      return [];
    case "boolean":
      return typeof field.default === "boolean" ? field.default : false;
    case "select": {
      const candidate = field.default;
      if (typeof candidate === "string" && field.options.includes(candidate)) {
        return candidate;
      }
      return field.options[0] ?? "";
    }
    case "text":
    case "textarea":
    case "url":
      return typeof field.default === "string" ? field.default : "";
    default:
      return field.default ?? null;
  }
}

export function defaultsForFields(fields: SectionField[]): SectionContent {
  return Object.fromEntries(
    fields.map((field) => [field.name, defaultForField(field)]),
  );
}
