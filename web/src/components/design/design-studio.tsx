"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionFieldsForm } from "@/components/builder/section-fields";
import { TemplateGallery } from "@/components/design/template-gallery";
import { ThemePreview } from "@/components/design/theme-preview";
import {
  getTheme,
  getThemeOptions,
  updateTheme,
  updateGlobalLayout,
} from "@/lib/api/theme";
import { applyTemplate, listTemplates } from "@/lib/api/templates";
import { ApiError } from "@/lib/api/client";
import { contrastRatio, meetsWcagAA } from "@/lib/theme/contrast";
import { themeValue } from "@/lib/theme/values";
import { validateSectionFields } from "@/lib/section/validation";
import type {
  Theme,
  ThemeGroup,
  ThemeOptions,
  ThemeValues,
  Template,
} from "@/types/theme";

interface DesignStudioProps {
  portfolioId: string;
}

type StudioTab = "theme" | "layout" | "templates";

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "loaded";
      options: ThemeOptions;
      templates: Template[];
      tokens: ThemeValues;
      components: ThemeValues;
    };

const TABS: { id: StudioTab; label: string }[] = [
  { id: "theme", label: "Theme" },
  { id: "layout", label: "Global layout" },
  { id: "templates", label: "Templates" },
];

function errorsForGroup(
  group: ThemeGroup | undefined,
  values: ThemeValues,
): Record<string, string> {
  if (!group) return {};
  return validateSectionFields(group.fields, values[group.name] ?? {});
}

function countErrors(groups: ThemeGroup[], values: ThemeValues): number {
  let total = 0;
  for (const group of groups) {
    total += Object.keys(errorsForGroup(group, values)).length;
  }
  return total;
}

export function DesignStudio({ portfolioId }: DesignStudioProps) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [tab, setTab] = useState<StudioTab>("theme");
  const [tokenGroupName, setTokenGroupName] = useState<string>("");
  const [layoutGroupName, setLayoutGroupName] = useState<string>("");
  const [tokensDirty, setTokensDirty] = useState(false);
  const [componentsDirty, setComponentsDirty] = useState(false);
  const [saving, setSaving] = useState<"tokens" | "components" | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      Promise.all([getThemeOptions(), getTheme(portfolioId), listTemplates()])
        .then(([options, theme, templates]) => {
          if (signal?.aborted) return;
          setLoad({
            state: "loaded",
            options,
            templates,
            tokens: theme.tokens,
            components: theme.components,
          });
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setLoad({
            state: "error",
            message:
              err instanceof Error ? err.message : "Unable to load the theme.",
          });
        });
    },
    [portfolioId],
  );

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  function updateTokens(updater: (current: ThemeValues) => ThemeValues) {
    setLoad((prev) =>
      prev.state === "loaded"
        ? { ...prev, tokens: updater(prev.tokens) }
        : prev,
    );
    setTokensDirty(true);
    setNotice(null);
  }

  function updateComponents(updater: (current: ThemeValues) => ThemeValues) {
    setLoad((prev) =>
      prev.state === "loaded"
        ? { ...prev, components: updater(prev.components) }
        : prev,
    );
    setComponentsDirty(true);
    setNotice(null);
  }

  async function handleSaveTokens() {
    if (load.state !== "loaded") return;
    if (countErrors(load.options.token_groups, load.tokens) > 0) return;
    setSaving("tokens");
    setError(null);
    try {
      const updated: Theme = await updateTheme(portfolioId, {
        tokens: load.tokens,
      });
      setLoad((prev) =>
        prev.state === "loaded" ? { ...prev, tokens: updated.tokens } : prev,
      );
      setTokensDirty(false);
      setNotice("Theme saved.");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : "Unable to save the theme.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveComponents() {
    if (load.state !== "loaded") return;
    if (countErrors(load.options.layout_groups, load.components) > 0) return;
    setSaving("components");
    setError(null);
    try {
      const updated = await updateGlobalLayout(portfolioId, {
        components: load.components,
      });
      setLoad((prev) =>
        prev.state === "loaded"
          ? { ...prev, components: updated.components }
          : prev,
      );
      setComponentsDirty(false);
      setNotice("Global layout saved.");
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save the global layout.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleApplyTemplate(template: Template) {
    if (load.state !== "loaded") return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Apply "${template.name}"? This replaces your current colors, typography, and layout settings. Your page and section content is not affected.`,
      )
    ) {
      return;
    }
    setApplyingId(template.id);
    setError(null);
    try {
      const updated: Theme = await applyTemplate(portfolioId, template.id);
      setLoad((prev) =>
        prev.state === "loaded"
          ? {
              ...prev,
              tokens: updated.tokens,
              components: updated.components,
            }
          : prev,
      );
      setTokensDirty(false);
      setComponentsDirty(false);
      setNotice(`Applied "${template.name}".`);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : "Unable to apply the template.",
      );
    } finally {
      setApplyingId(null);
    }
  }

  const contrastWarnings = useMemo(() => {
    if (load.state !== "loaded") return [];
    const tokens = load.tokens;
    const pairs: { label: string; fg: string; bg: string }[] = [
      {
        label: "Body text on page background",
        fg: themeValue(tokens, "colors", "text"),
        bg: themeValue(tokens, "colors", "page_background"),
      },
      {
        label: "Header text on header background",
        fg: themeValue(tokens, "colors", "header_text"),
        bg: themeValue(tokens, "colors", "header_background"),
      },
      {
        label: "Footer text on footer background",
        fg: themeValue(tokens, "colors", "footer_text"),
        bg: themeValue(tokens, "colors", "footer_background"),
      },
      {
        label: "Button text on button background",
        fg: themeValue(tokens, "colors", "button_text"),
        bg: themeValue(tokens, "colors", "button_background"),
      },
    ];
    const warnings: string[] = [];
    for (const pair of pairs) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      if (ratio !== null && !meetsWcagAA(ratio)) {
        warnings.push(`${pair.label} (${ratio.toFixed(1)}:1).`);
      }
    }
    return warnings;
  }, [load]);

  if (load.state === "loading") {
    return <p className="text-slate-600 dark:text-slate-400">Loading theme…</p>;
  }

  if (load.state === "error") {
    return (
      <div className="space-y-3">
        <p className="text-rose-600">{load.message}</p>
        <Button variant="secondary" onClick={() => refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const { options, templates, tokens, components } = load;
  const tokenGroup =
    options.token_groups.find((g) => g.name === tokenGroupName) ??
    options.token_groups[0];
  const layoutGroup =
    options.layout_groups.find((g) => g.name === layoutGroupName) ??
    options.layout_groups[0];

  const tokenGroupErrors = errorsForGroup(tokenGroup, tokens);
  const layoutGroupErrors = errorsForGroup(layoutGroup, components);
  const tokenErrorCount = countErrors(options.token_groups, tokens);
  const layoutErrors = countErrors(options.layout_groups, components);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Design sections">
        {TABS.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "primary" : "secondary"}
            onClick={() => {
              setTab(item.id);
              setError(null);
            }}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {notice ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      {tab === "theme" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" aria-label="Theme groups">
              {options.token_groups.map((group) => (
                <Button
                  key={group.name}
                  variant={
                    group.name === tokenGroup?.name ? "primary" : "secondary"
                  }
                  onClick={() => setTokenGroupName(group.name)}
                >
                  {group.label}
                </Button>
              ))}
            </div>
            {tokenGroup ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {tokenGroup.description}
                </p>
                <SectionFieldsForm
                  fields={tokenGroup.fields}
                  values={tokens[tokenGroup.name] ?? {}}
                  errors={tokenGroupErrors}
                  onChange={(name, value) =>
                    updateTokens((current) => ({
                      ...current,
                      [tokenGroup.name]: {
                        ...(current[tokenGroup.name] ?? {}),
                        [name]: value,
                      },
                    }))
                  }
                  idPrefix={`token-${tokenGroup.name}`}
                  prefix=""
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveTokens}
                    disabled={
                      saving !== null || tokenErrorCount > 0 || !tokensDirty
                    }
                  >
                    {saving === "tokens" ? "Saving…" : "Save theme"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => updateTokens(() => options.default_tokens)}
                    disabled={saving !== null}
                  >
                    Reset to defaults
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Preview
            </h3>
            <ThemePreview tokens={tokens} components={components} />
            {contrastWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <p className="font-medium">Low contrast</p>
                <ul className="mt-1 list-disc pl-4">
                  {contrastWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {tab === "layout" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              These settings drive the site chrome shown in the preview.
              Settings that only take effect on the published site — sticky
              scrolling, mobile collapse, the favicon, and link destinations —
              are labelled under their control.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Layout groups">
              {options.layout_groups.map((group) => (
                <Button
                  key={group.name}
                  variant={
                    group.name === layoutGroup?.name ? "primary" : "secondary"
                  }
                  onClick={() => setLayoutGroupName(group.name)}
                >
                  {group.label}
                </Button>
              ))}
            </div>
            {layoutGroup ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {layoutGroup.description}
                </p>
                <SectionFieldsForm
                  fields={layoutGroup.fields}
                  values={components[layoutGroup.name] ?? {}}
                  errors={layoutGroupErrors}
                  onChange={(name, value) =>
                    updateComponents((current) => ({
                      ...current,
                      [layoutGroup.name]: {
                        ...(current[layoutGroup.name] ?? {}),
                        [name]: value,
                      },
                    }))
                  }
                  idPrefix={`layout-${layoutGroup.name}`}
                  prefix=""
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveComponents}
                    disabled={
                      saving !== null || layoutErrors > 0 || !componentsDirty
                    }
                  >
                    {saving === "components" ? "Saving…" : "Save global layout"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateComponents(() => options.default_components)
                    }
                    disabled={saving !== null}
                  >
                    Reset to defaults
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Preview
            </h3>
            <ThemePreview tokens={tokens} components={components} />
          </aside>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Templates set colors, typography, and layout. Applying one never
            changes your page or section content.
          </p>
          <TemplateGallery
            templates={templates}
            applyingId={applyingId}
            onApply={handleApplyTemplate}
            disabled={saving !== null}
          />
        </div>
      ) : null}
    </div>
  );
}
