"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getNavigation, replaceNavigation } from "@/lib/api/navigation";
import { listPages } from "@/lib/api/pages";
import { ApiError } from "@/lib/api/client";
import {
  validateExternalUrl,
  validateNavigationLabel,
} from "@/lib/page/validation";
import type { Page } from "@/types/page";
import type {
  NavigationDestinationType,
  NavigationItem,
  NavigationItemInput,
  NavigationLocation,
} from "@/types/navigation";

interface DraftItem {
  key: string;
  location: NavigationLocation;
  label: string;
  destinationType: NavigationDestinationType;
  pageId: string;
  externalUrl: string;
  isVisible: boolean;
}

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; pages: Page[] };

const LOCATIONS: NavigationLocation[] = ["header", "footer", "sidebar"];

function makeKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `nav-${Math.random().toString(36).slice(2)}`;
}

function toDrafts(items: NavigationItem[]): DraftItem[] {
  return items.map((item) => ({
    key: item.id,
    location: item.location,
    label: item.label,
    destinationType: item.destination_type,
    pageId: item.page_id ?? "",
    externalUrl: item.external_url ?? "",
    isVisible: item.is_visible,
  }));
}

interface NavigationManagerProps {
  portfolioId: string;
}

export function NavigationManager({ portfolioId }: NavigationManagerProps) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      Promise.all([listPages(portfolioId), getNavigation(portfolioId)])
        .then(([pages, items]) => {
          if (signal?.aborted) return;
          setLoad({ state: "loaded", pages });
          setDrafts(toDrafts(items));
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoad({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load navigation.",
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

  function updateDraft(key: string, changes: Partial<DraftItem>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    );
    setSavedAt(null);
  }

  function addItem() {
    setDrafts((current) => [
      ...current,
      {
        key: makeKey(),
        location: "header",
        label: "",
        destinationType: "page",
        pageId: load.state === "loaded" ? (load.pages[0]?.id ?? "") : "",
        externalUrl: "",
        isVisible: true,
      },
    ]);
    setSavedAt(null);
  }

  function removeItem(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
    setSavedAt(null);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction;
      const a = current[index];
      const b = current[target];
      if (!a || !b) return current;
      const next = [...current];
      next[index] = b;
      next[target] = a;
      return next;
    });
    setSavedAt(null);
  }

  function validateDrafts(): Record<string, string> {
    const next: Record<string, string> = {};
    for (const draft of drafts) {
      const labelError = validateNavigationLabel(draft.label);
      if (labelError) {
        next[draft.key] = labelError;
        continue;
      }
      if (draft.destinationType === "page") {
        if (!draft.pageId) {
          next[draft.key] = "Choose a page for this link.";
          continue;
        }
      } else {
        const urlError = validateExternalUrl(draft.externalUrl);
        if (urlError) {
          next[draft.key] = urlError;
        }
      }
    }
    return next;
  }

  async function handleSave() {
    const nextErrors = validateDrafts();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const items: NavigationItemInput[] = drafts.map((draft) => {
      if (draft.destinationType === "page") {
        return {
          location: draft.location,
          label: draft.label.trim(),
          destination_type: "page",
          page_id: draft.pageId,
          external_url: null,
          is_visible: draft.isVisible,
        };
      }
      return {
        location: draft.location,
        label: draft.label.trim(),
        destination_type: "external_url",
        page_id: null,
        external_url: draft.externalUrl.trim(),
        is_visible: draft.isVisible,
      };
    });

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await replaceNavigation(portfolioId, items);
      setDrafts(toDrafts(saved));
      setSavedAt(Date.now());
    } catch (error: unknown) {
      setSaveError(
        error instanceof ApiError
          ? error.message
          : "Unable to save navigation.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (load.state === "loading") {
    return <p className="text-slate-600">Loading navigation…</p>;
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

  const pages = load.pages;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Build the site menu from your pages or external links. The order here is
        the order visitors see, split by header, footer, and sidebar.
      </p>

      {drafts.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          No navigation items yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft, index) => (
            <li
              key={draft.key}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="block font-medium text-slate-700 dark:text-slate-300">
                    Label
                  </span>
                  <input
                    value={draft.label}
                    onChange={(event) =>
                      updateDraft(draft.key, { label: event.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    aria-invalid={errors[draft.key] ? true : undefined}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="block font-medium text-slate-700 dark:text-slate-300">
                    Location
                  </span>
                  <select
                    value={draft.location}
                    onChange={(event) =>
                      updateDraft(draft.key, {
                        location: event.target.value as NavigationLocation,
                      })
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {LOCATIONS.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="block font-medium text-slate-700 dark:text-slate-300">
                    Destination
                  </span>
                  <select
                    value={draft.destinationType}
                    onChange={(event) =>
                      updateDraft(draft.key, {
                        destinationType: event.target
                          .value as NavigationDestinationType,
                      })
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="page">Page</option>
                    <option value="external_url">External URL</option>
                  </select>
                </label>

                {draft.destinationType === "page" ? (
                  <label className="space-y-1 text-sm">
                    <span className="block font-medium text-slate-700 dark:text-slate-300">
                      Page
                    </span>
                    <select
                      value={draft.pageId}
                      onChange={(event) =>
                        updateDraft(draft.key, { pageId: event.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">Select a page…</option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="space-y-1 text-sm">
                    <span className="block font-medium text-slate-700 dark:text-slate-300">
                      URL
                    </span>
                    <input
                      value={draft.externalUrl}
                      placeholder="https://example.com"
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          externalUrl: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      aria-invalid={errors[draft.key] ? true : undefined}
                    />
                  </label>
                )}
              </div>

              {errors[draft.key] ? (
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                  {errors[draft.key]}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.isVisible}
                    onChange={(event) =>
                      updateDraft(draft.key, {
                        isVisible: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Visible
                </label>
                <Button
                  variant="secondary"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Move item up"
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === drafts.length - 1}
                  aria-label="Move item down"
                >
                  ↓
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => removeItem(draft.key)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {saveError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {saveError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={addItem}>
          Add item
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save navigation"}
        </Button>
        {savedAt !== null ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
