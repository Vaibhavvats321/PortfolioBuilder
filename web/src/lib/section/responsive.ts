import type { SectionStyle } from "@/types/section";

/**
 * Shared responsive breakpoint definitions.
 *
 * This mirrors the backend constants in `api/app/sections/responsive.py`
 * (`BREAKPOINTS` / `DEFAULT_BREAKPOINT`). Keep the two in sync: the editor and
 * the preview must agree on the same breakpoint identifiers, and the stored
 * override shape must stay `{ breakpoint: <style object> | null }`.
 */
export const RESPONSIVE_BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;

export type ResponsiveBreakpoint = (typeof RESPONSIVE_BREAKPOINTS)[number];

export const DEFAULT_BREAKPOINT: ResponsiveBreakpoint = "desktop";

/**
 * Per-breakpoint style overrides. `null` means "inherit the section's base
 * style" for that breakpoint.
 */
export type ResponsiveStyleOverrides = Record<
  ResponsiveBreakpoint,
  SectionStyle | null
>;

export function defaultResponsiveOverrides(): ResponsiveStyleOverrides {
  return { desktop: null, tablet: null, mobile: null };
}

/** Coerce an untrusted stored value into a complete override mapping. */
export function normalizeResponsiveOverrides(
  value: unknown,
): ResponsiveStyleOverrides {
  const overrides = defaultResponsiveOverrides();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return overrides;
  }
  const record = value as Record<string, unknown>;
  for (const breakpoint of RESPONSIVE_BREAKPOINTS) {
    const entry = record[breakpoint];
    if (entry === null || entry === undefined) {
      overrides[breakpoint] = null;
    } else if (typeof entry === "object" && !Array.isArray(entry)) {
      overrides[breakpoint] = entry as SectionStyle;
    }
  }
  return overrides;
}

/**
 * Resolve the style a preview should render for a breakpoint: the section's
 * base style with that breakpoint's override layered on top.
 */
export function resolveSectionStyle(
  style: SectionStyle | undefined,
  breakpoint: ResponsiveBreakpoint,
): SectionStyle {
  const base = style ?? {};
  const overrides = normalizeResponsiveOverrides(base.responsive_override);
  const override = overrides[breakpoint];
  if (!override) {
    return { ...base };
  }
  return { ...base, ...override };
}
