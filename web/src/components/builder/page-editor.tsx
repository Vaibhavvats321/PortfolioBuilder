"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { SectionInspector } from "@/components/builder/section-inspector";
import { SectionLibrary } from "@/components/builder/section-library";
import { SectionList } from "@/components/builder/section-list";
import { SectionPreview } from "@/components/builder/section-preview";
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
import type { PageSection, SectionContent, SectionType } from "@/types/section";

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
    try {
      return await fn();
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiError ? error.message : "Unable to update section.",
      );
      return undefined;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(typeId: string) {
    setFormError(null);
    try {
      const created = await createSection(pageId, { section_type: typeId });
      setLoad((prev) => {
        if (prev.state !== "loaded") return prev;
        return { ...prev, sections: [...prev.sections, created] };
      });
      setSelectedId(created.id);
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to create section.",
      );
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
  }) {
    if (!selected || !selectedId) return;
    setSaving(true);
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
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to save section.",
      );
    } finally {
      setSaving(false);
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
              onSave={handleSaveSection}
              saving={saving}
              error={formError}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-medium">Preview</h2>
            {selected ? (
              <SectionPreview
                section={selected}
                sectionType={types.find(
                  (t) => t.type_id === selected.section_type,
                )}
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
