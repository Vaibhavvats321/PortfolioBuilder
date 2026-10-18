"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  EditorToolbar,
  type SaveStatus,
} from "@/components/builder/editor-toolbar";
import { SectionInspector } from "@/components/builder/section-inspector";
import { SectionLibrary } from "@/components/builder/section-library";
import { SectionList } from "@/components/builder/section-list";
import { SectionPreview } from "@/components/builder/section-preview";
import { fetchPortfolio } from "@/lib/api/portfolios";
import { publishPortfolio } from "@/lib/api/publication";
import {
  createSection,
  deleteSection,
  duplicateSection,
  listSectionTypes,
  listSections,
  reorderSections,
  updateSection,
} from "@/lib/api/sections";
import { ApiError } from "@/lib/api/client";
import {
  DEFAULT_BREAKPOINT,
  RESPONSIVE_BREAKPOINTS,
  type ResponsiveBreakpoint,
} from "@/lib/section/responsive";
import type {
  PageSection,
  SectionContent,
  SectionStyle,
  SectionType,
} from "@/types/section";
import type { PortfolioStatus } from "@/types/portfolio";

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; sections: PageSection[]; types: SectionType[] };

interface PageEditorProps {
  portfolioId: string;
  pageId: string;
}

export function PageEditor({ portfolioId, pageId }: PageEditorProps) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewBreakpoint, setPreviewBreakpoint] =
    useState<ResponsiveBreakpoint>(DEFAULT_BREAKPOINT);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formState, setFormState] = useState({
    dirty: false,
    hasErrors: false,
  });
  const [portfolioStatus, setPortfolioStatus] =
    useState<PortfolioStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{
    version: number;
    publicPath: string;
  } | null>(null);
  const [saveRequest, setSaveRequest] = useState(0);

  const handleFormStateChange = useCallback(
    (state: { dirty: boolean; hasErrors: boolean }) => {
      setFormState(state);
    },
    [],
  );

  const handleSaveDraft = useCallback(() => {
    setSaveRequest((count) => count + 1);
  }, []);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      Promise.all([listSections(pageId), listSectionTypes()])
        .then(([sections, types]) => {
          if (signal?.aborted) return;
          setLoad({ state: "loaded", sections, types });
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoad({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load sections.",
          });
        });
    },
    [pageId],
  );

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPortfolio(portfolioId)
      .then((portfolio) => {
        if (controller.signal.aborted) return;
        setPortfolioStatus(portfolio.status);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [portfolioId]);

  const selected = useMemo(() => {
    if (!selectedId || load.state !== "loaded") return null;
    return load.sections.find((s) => s.id === selectedId) ?? null;
  }, [selectedId, load]);

  async function runAction<T>(
    sectionId: string,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    setBusyId(sectionId);
    setActionError(null);
    setSaveStatus("saving");
    try {
      const result = await fn();
      setSaveStatus("saved");
      return result;
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiError ? error.message : "Unable to update section.",
      );
      setSaveStatus("error");
      return undefined;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(typeId: string) {
    setFormError(null);
    setSaveStatus("saving");
    try {
      const created = await createSection(pageId, { section_type: typeId });
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return { ...prev, sections: [...prev.sections, created] };
      });
      setSelectedId(created.id);
      setSaveStatus("saved");
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to create section.",
      );
      setSaveStatus("error");
    }
  }

  async function handleMove(sectionId: string, direction: -1 | 1) {
    if (load.state !== "loaded") return;
    const idx = load.sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= load.sections.length) return;
    const ids = load.sections
      .map((s) => s.id)
      .filter((id): id is string => typeof id === "string");
    const res = await runAction(sectionId, () => reorderSections(pageId, ids));
    if (res) {
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return { ...prev, sections: res };
      });
    }
  }

  async function handleToggleVisibility(section: PageSection) {
    const res = await runAction(section.id, () =>
      updateSection(section.id, { is_visible: !section.is_visible }),
    );
    if (res) {
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) => (s.id === section.id ? res : s)),
        };
      });
    }
  }

  async function handleDuplicate(section: PageSection) {
    const res = await runAction(section.id, () => duplicateSection(section.id));
    if (res) {
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return { ...prev, sections: [...prev.sections, res] };
      });
      setSelectedId(res.id ?? null);
    }
  }

  async function handleDelete(section: PageSection) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete the section "${section.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    await runAction(section.id, () => deleteSection(section.id));
    setLoad((prev) => {
      if (prev.state !== "loaded") return prev;
      const nextSections = prev.sections.filter((s) => s.id !== section.id);
      if (selectedId === section.id) {
        setSelectedId(null);
      }
      return { ...prev, sections: nextSections };
    });
  }

  async function handleSaveSection(patch: {
    name?: string;
    is_visible?: boolean;
    content?: SectionContent;
    layout?: Record<string, unknown>;
    style?: SectionStyle;
  }): Promise<boolean> {
    if (!selected || !selectedId) return false;
    setSaving(true);
    setSaveStatus("saving");
    setFormError(null);
    try {
      const res = await updateSection(selectedId, patch);
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) => (s.id === selectedId ? res : s)),
        };
      });
      setSaveStatus("saved");
      return true;
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save section.",
      );
      setSaveStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishPortfolio(portfolioId);
      setPortfolioStatus("published");
      setPublishResult({
        version: result.version_number,
        publicPath: result.public_path,
      });
    } catch (error: unknown) {
      setPublishError(
        error instanceof ApiError ? error.message : "Unable to publish.",
      );
    } finally {
      setPublishing(false);
    }
  }

  if (load.state === "loading") {
    return <p className="text-slate-600">Loading sections…</p>;
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

  const { sections, types } = load;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Page editor</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {sections.length} section{sections.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/dashboard/portfolios/${portfolioId}`}
          className={buttonClassName("secondary")}
        >
          Back to portfolio
        </Link>
      </div>

      <EditorToolbar
        portfolioId={portfolioId}
        saveStatus={saveStatus}
        dirty={formState.dirty}
        hasErrors={formState.hasErrors}
        onSaveDraft={handleSaveDraft}
        publication={{
          status: portfolioStatus,
          publishing,
          error: publishError,
          result: publishResult,
        }}
        onPublish={handlePublish}
      />

      {(formError || actionError) && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {formError ?? actionError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-medium">Sections</h2>
            <SectionList
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleMove}
              onToggleVisibility={handleToggleVisibility}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              busyId={busyId}
              sectionTypes={types}
            />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-medium">Add section</h2>
            <SectionLibrary
              sectionTypes={types}
              onAdd={handleAdd}
              disabled={busyId !== null || saving}
            />
          </section>
        </div>

        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-medium">Inspector</h2>
            <SectionInspector
              section={selected}
              sectionTypes={types}
              portfolioId={portfolioId}
              onSave={handleSaveSection}
              saving={saving}
              error={formError}
              onFormStateChange={handleFormStateChange}
              saveRequest={saveRequest}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Preview</h2>
              {selected ? (
                <div
                  role="group"
                  aria-label="Preview breakpoint"
                  className="flex gap-1"
                >
                  {RESPONSIVE_BREAKPOINTS.map((breakpoint) => (
                    <Button
                      key={breakpoint}
                      variant={
                        previewBreakpoint === breakpoint
                          ? "primary"
                          : "secondary"
                      }
                      aria-pressed={previewBreakpoint === breakpoint}
                      onClick={() => setPreviewBreakpoint(breakpoint)}
                      className="px-3 py-1 text-xs"
                    >
                      {breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            {selected ? (
              <SectionPreview
                section={selected}
                sectionType={types.find(
                  (t) => t.type_id === selected.section_type,
                )}
                breakpoint={previewBreakpoint}
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select a section to preview it.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
