"use client";

import { Button } from "@/components/ui/button";
import { themeValue } from "@/lib/theme/values";
import type { Template } from "@/types/theme";

interface TemplateGalleryProps {
  templates: Template[];
  applyingId: string | null;
  onApply: (template: Template) => void;
  disabled?: boolean;
}

const SWATCH_TOKENS = [
  "primary",
  "secondary",
  "accent",
  "page_background",
] as const;

export interface TemplateSwatch {
  token: string;
  color: string;
}

/**
 * Colour swatches shown for a template. Keyed by the theme token rather than
 * the colour value, so two tokens with the same colour still produce unique,
 * stable React keys.
 */
export function templateSwatches(template: Template): TemplateSwatch[] {
  return SWATCH_TOKENS.map((token) => ({
    token,
    color: themeValue(template.tokens, "colors", token),
  })).filter((swatch) => swatch.color);
}

/**
 * Lists the available starter templates. Applying a template is explicit and
 * replaces the design only (tokens + global layout); it never touches page or
 * section content.
 */
export function TemplateGallery({
  templates,
  applyingId,
  onApply,
  disabled = false,
}: TemplateGalleryProps) {
  if (templates.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No templates are available.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {templates.map((template) => {
        const swatches = templateSwatches(template);
        const applying = applyingId === template.id;
        return (
          <li
            key={template.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex gap-1">
              {swatches.map((swatch) => (
                <span
                  key={swatch.token}
                  className="h-6 w-6 rounded-full border border-slate-200 dark:border-slate-700"
                  style={{ background: swatch.color }}
                />
              ))}
            </div>
            <h3 className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              {template.name}
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {template.description}
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={() => onApply(template)}
                disabled={disabled || applying}
              >
                {applying ? "Applying…" : "Apply template"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
