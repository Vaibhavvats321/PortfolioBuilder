"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SectionFieldsForm,
  pathFor,
} from "@/components/builder/section-fields";
import {
  DEFAULT_BREAKPOINT,
  RESPONSIVE_BREAKPOINTS,
  normalizeResponsiveOverrides,
  type ResponsiveBreakpoint,
} from "@/lib/section/responsive";
import type { SectionContent, SectionField } from "@/types/section";

const BREAKPOINT_LABELS: Record<ResponsiveBreakpoint, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

interface ResponsiveOverrideEditorProps {
  /** The registry `responsive_override` object field. */
  field: SectionField;
  /** Stored override value (untrusted); normalized before use. */
  value: unknown;
  /** Error for the override field itself (shape / unknown breakpoints). */
  error?: string;
  /** Full dotted-path error map from `validateSectionFields`. */
  errors: Record<string, string>;
  /**
   * The container's own values (the section's base style). Breakpoint entries
   * are partial, so controls display the base value for keys the override has
   * not set; only edited keys are stored.
   */
  containerValues: SectionContent;
  onChange: (value: unknown) => void;
  idBase: string;
  prefix: string;
}

/**
 * Per-breakpoint style override editor for the `responsive_override` style
 * field. Each breakpoint starts as `null` (inherit the base style); choosing
 * "Customize" creates a partial override object where only the fields the
 * user changes are stored, matching the backend's `validate_partial_fields`
 * semantics. Stored objects are never mutated: every change produces a fresh
 * mapping, so the section draft in the inspector stays intact.
 */
export function ResponsiveOverrideEditor({
  field,
  value,
  error,
  errors,
  containerValues,
  onChange,
  idBase,
  prefix,
}: ResponsiveOverrideEditorProps) {
  const overrides = normalizeResponsiveOverrides(value);
  const [active, setActive] =
    useState<ResponsiveBreakpoint>(DEFAULT_BREAKPOINT);
  const entry = overrides[active];
  const fieldPath = pathFor(prefix, field.name);
  const activeError = errors[`${fieldPath}.${active}`];

  function setEntry(next: SectionContent | null) {
    onChange({ ...overrides, [active]: next });
  }

  return (
    <fieldset
      className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
      data-testid="responsive-override-editor"
    >
      <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        {field.label}
      </legend>
      <div
        role="group"
        aria-label="Responsive breakpoint"
        className="flex gap-1"
      >
        {RESPONSIVE_BREAKPOINTS.map((breakpoint) => (
          <button
            key={breakpoint}
            type="button"
            aria-pressed={active === breakpoint}
            onClick={() => setActive(breakpoint)}
            className={[
              "rounded-md px-3 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
              active === breakpoint
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
            ].join(" ")}
          >
            {BREAKPOINT_LABELS[breakpoint]}
          </button>
        ))}
      </div>

      {entry === null ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Using the section&apos;s base style for {BREAKPOINT_LABELS[active]}.
            Customize to set values only for this breakpoint.
          </p>
          <Button variant="secondary" onClick={() => setEntry({})}>
            Customize {BREAKPOINT_LABELS[active]}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Custom values for {BREAKPOINT_LABELS[active]}. Fields left unchanged
            keep tracking the section&apos;s base style.
          </p>
          <SectionFieldsForm
            fields={field.fields}
            values={{ ...containerValues, ...entry }}
            errors={errors}
            onChange={(name, next) => setEntry({ ...entry, [name]: next })}
            idPrefix={`${idBase}-${fieldPath.replace(/\./g, "-")}-${active}`}
            prefix={`${fieldPath}.${active}`}
          />
          <Button variant="secondary" onClick={() => setEntry(null)}>
            Reset {BREAKPOINT_LABELS[active]} to inherit
          </Button>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      {activeError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {activeError}
        </p>
      ) : null}
    </fieldset>
  );
}
