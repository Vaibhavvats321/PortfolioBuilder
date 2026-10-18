"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { SectionPreview } from "@/components/builder/section-preview";
import { fetchPortfolioPreview } from "@/lib/api/publication";
import { listSectionTypes } from "@/lib/api/sections";
import { ApiError } from "@/lib/api/client";
import {
  RESPONSIVE_BREAKPOINTS,
  type ResponsiveBreakpoint,
} from "@/lib/section/responsive";
import { buildPreviewTheme } from "@/lib/theme/style";
import type { SectionType } from "@/types/section";
import type { PortfolioPreview } from "@/types/preview";

type PreviewState =
  | { state: "loading" }
  | { state: "unauthenticated" }
  | { state: "error"; message: string }
  | { state: "loaded"; preview: PortfolioPreview; types: SectionType[] };

interface DraftPreviewProps {
  portfolioId: string;
}

const DEVICE_MAX_WIDTH: Record<ResponsiveBreakpoint, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

/**
 * Owner-only preview of the latest draft. It renders the live draft bundle
 * (never the published snapshot) with the shared section renderers under an
 * unmistakable "DRAFT PREVIEW" banner, and is served from a `noindex` route
 * so search engines are never asked to index it.
 */
export function DraftPreview({ portfolioId }: DraftPreviewProps) {
  const [load, setLoad] = useState<PreviewState>({ state: "loading" });
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<ResponsiveBreakpoint>("desktop");

  const fetchPreview = useCallback(
    (signal?: AbortSignal) => {
      Promise.all([fetchPortfolioPreview(portfolioId), listSectionTypes()])
        .then(([preview, types]) => {
          if (signal?.aborted) return;
          setLoad({ state: "loaded", preview, types });
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          if (error instanceof ApiError && error.status === 401) {
            setLoad({ state: "unauthenticated" });
            return;
          }
          setLoad({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load the draft preview.",
          });
        });
    },
    [portfolioId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPreview(controller.signal);
    return () => controller.abort();
  }, [fetchPreview]);

  function handleRetry() {
    setLoad({ state: "loading" });
    fetchPreview();
  }

  if (load.state === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Loading draft preview…</p>
      </main>
    );
  }

  if (load.state === "unauthenticated") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-3 text-slate-600">Sign in to preview your draft.</p>
        <Link href="/login" className={buttonClassName("primary")}>
          Sign in
        </Link>
      </main>
    );
  }

  if (load.state === "error") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-3 text-rose-600">{load.message}</p>
        <Button variant="secondary" onClick={handleRetry}>
          Retry
        </Button>
      </main>
    );
  }

  const { preview, types } = load;
  const orderedPages = [...preview.pages].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const activePage =
    orderedPages.find((page) => page.id === selectedPageId) ??
    orderedPages.find((page) => page.is_homepage) ??
    orderedPages[0] ??
    null;
  const t = buildPreviewTheme(preview.theme.tokens);
  const pageStyle: CSSProperties = {
    background: t.pageBackground,
    color: t.text,
    fontFamily: t.bodyFont,
    fontSize: t.baseSize,
    fontWeight: t.bodyWeight,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textAlign: t.textAlign,
    borderColor: t.border,
  };
  const headerNav = preview.navigation.filter(
    (item) => item.is_visible && item.location === "header",
  );

  return (
    <div className="min-h-screen">
      <div
        role="status"
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-900"
      >
        <span className="font-semibold tracking-wide uppercase">
          Draft preview — not published
        </span>
        <span className="text-xs">
          Latest draft, visible only to you. Search engines never see this page.
        </span>
        <Link
          href={`/dashboard/portfolios/${portfolioId}`}
          className="text-xs font-medium underline"
        >
          Back to editor
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          Page
          <select
            value={activePage?.id ?? ""}
            onChange={(event) => setSelectedPageId(event.target.value)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {orderedPages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
                {page.is_homepage ? " (home)" : ""}
                {!page.is_visible ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Preview device" className="flex gap-1">
          {RESPONSIVE_BREAKPOINTS.map((mode) => (
            <Button
              key={mode}
              variant={breakpoint === mode ? "primary" : "secondary"}
              aria-pressed={breakpoint === mode}
              onClick={() => setBreakpoint(mode)}
              className="px-3 py-1 text-xs"
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div
        className="mx-auto px-4 py-6"
        style={pageStyle}
        aria-label="Draft site preview"
      >
        <div
          className="mx-auto space-y-6"
          style={{ maxWidth: DEVICE_MAX_WIDTH[breakpoint] }}
        >
          <header
            className="flex flex-wrap items-center justify-between gap-3 rounded border px-4 py-3"
            style={{
              background: t.headerBackground,
              color: t.headerText,
              borderColor: t.border,
            }}
          >
            <span className="font-semibold">{preview.portfolio.name}</span>
            <nav
              className="flex flex-wrap gap-3 text-sm"
              aria-label="Draft navigation"
            >
              {headerNav.map((item) =>
                item.destination_type === "page" && item.page_id ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPageId(item.page_id ?? null)}
                    className="hover:underline"
                    style={{ color: t.link }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span key={item.id}>{item.label}</span>
                ),
              )}
            </nav>
          </header>

          {activePage ? (
            <div className="space-y-4">
              {activePage.sections
                .filter((section) => section.is_visible)
                .map((section) => (
                  <SectionPreview
                    key={section.id}
                    section={section}
                    sectionType={types.find(
                      (type) => type.type_id === section.section_type,
                    )}
                    breakpoint={breakpoint}
                  />
                ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">
              This draft has no pages yet. Create one in the editor.
            </p>
          )}

          <footer
            className="rounded border px-4 py-3 text-xs"
            style={{
              background: t.footerBackground,
              color: t.footerText,
              borderColor: t.border,
            }}
          >
            © {new Date().getFullYear()} {preview.portfolio.name}
          </footer>
        </div>
      </div>
    </div>
  );
}
