import type { ThemeValues } from "@/types/theme";

/** Read a string design value, returning `""` when missing or not a string. */
export function themeValue(
  values: ThemeValues | undefined,
  group: string,
  field: string,
): string {
  const value = values?.[group]?.[field];
  return typeof value === "string" ? value : "";
}

/**
 * Read a boolean design value. Unset or non-boolean values fall back to
 * `fallback`, so an omitted option keeps the registry's declared default.
 */
export function themeFlag(
  values: ThemeValues | undefined,
  group: string,
  field: string,
  fallback = false,
): boolean {
  const value = values?.[group]?.[field];
  return typeof value === "boolean" ? value : fallback;
}
