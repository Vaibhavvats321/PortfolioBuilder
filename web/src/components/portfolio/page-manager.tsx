"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PageForm,
  type PageFormValues,
} from "@/components/portfolio/page-form";
import {
  createPage,
  deletePage,
  listPages,
  reorderPages,
  updatePage,
} from "@/lib/api/pages";
import { ApiError } from "@/lib/api/client";
import type { Page, PageCreatePayload, PageUpdatePayload } from "@/types/page";

type LoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; pages: Page[] };

interface PageManagerProps {
  portfolioId: string;
}

export function PageManager({ portfolioId }: PageManagerProps) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      listPages(portfolioId)
        .then((pages) => {
          if (signal?.aborted) return;
          setLoad({ state: "loaded", pages });
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoad({
            state: "error",
            message:
              error instanceof Error ? error.message : "Unable to load pages.",
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

  function toCreatePayload(values: PageFormValues): PageCreatePayload {
    const payload: PageCreatePayload = {
      title: values.title,
      is_visible: values.isVisible,
      seo_title: values.seoTitle ? values.seoTitle : null,
      seo_description: values.seoDescription ? values.seoDescription : null,
    };
    if (values.slug) {
      payload.slug = values.slug;
    }
    return payload;
  }

  function toUpdatePayload(values: PageFormValues): PageUpdatePayload {
    const payload: PageUpdatePayload = {
      title: values.title,
      is_visible: values.isVisible,
      seo_title: values.seoTitle ? values.seoTitle : null,
      seo_description: values.seoDescription ? values.seoDescription : null,
    };
    if (values.slug) {
      payload.slug = values.slug;
    }
    return payload;
  }

  async function handleCreate(values: PageFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await createPage(portfolioId, toCreatePayload(values));
      setCreating(false);
      refresh();
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to create page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(pageId: string, values: PageFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await updatePage(pageId, toUpdatePayload(values));
      setEditingId(null);
      refresh();
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to update page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function runRowAction(pageId: string, action: () => Promise<unknown>) {
    setBusyId(pageId);
    setActionError(null);
    try {
      await action();
      refresh();
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiError ? error.message : "Unable to update page.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(page: Page) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete the page "${page.title}"? This cannot be undone.`)
    ) {
      return;
    }
    await runRowAction(page.id, () => deletePage(page.id));
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (load.state !== "loaded") return;
    const target = index + direction;
    const current = load.pages[index];
    const neighbor = load.pages[target];
    if (!current || !neighbor) return;
    const ids = load.pages.map((page) => page.id);
    const moved = ids[index];
    const displaced = ids[target];
    if (moved === undefined || displaced === undefined) return;
    ids[index] = displaced;
    ids[target] = moved;
    await runRowAction(current.id, () => reorderPages(portfolioId, ids));
  }

  if (load.state === "loading") {
    return <p className="text-slate-600">Loading pages…</p>;
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {pages.length} page{pages.length === 1 ? "" : "s"}
        </p>
        {!creating ? (
          <Button
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setFormError(null);
            }}
          >
            Add page
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      {creating ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-medium">New page</h3>
          <PageForm
            mode="create"
            submitting={submitting}
            formError={formError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
          />
        </div>
      ) : null}

      {pages.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          This portfolio has no pages yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {pages.map((page, index) => (
            <li
              key={page.id}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {page.title}
                    {page.is_homepage ? (
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
                        Homepage
                      </span>
                    ) : null}
                    {!page.is_visible ? (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    /{page.slug} · {page.status}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || busyId === page.id}
                    aria-label={`Move ${page.title} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === pages.length - 1 || busyId === page.id}
                    aria-label={`Move ${page.title} down`}
                  >
                    ↓
                  </Button>
                  {!page.is_homepage ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        runRowAction(page.id, () =>
                          updatePage(page.id, { is_homepage: true }),
                        )
                      }
                      disabled={busyId === page.id}
                    >
                      Set as homepage
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      runRowAction(page.id, () =>
                        updatePage(page.id, { is_visible: !page.is_visible }),
                      )
                    }
                    disabled={busyId === page.id}
                  >
                    {page.is_visible ? "Hide" : "Show"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(editingId === page.id ? null : page.id);
                      setCreating(false);
                      setFormError(null);
                    }}
                  >
                    {editingId === page.id ? "Close" : "Edit"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDelete(page)}
                    disabled={page.is_homepage || busyId === page.id}
                    title={
                      page.is_homepage
                        ? "Assign another page as the homepage first."
                        : undefined
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {editingId === page.id ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <PageForm
                    mode="edit"
                    initialValues={{
                      title: page.title,
                      slug: page.slug,
                      isVisible: page.is_visible,
                      seoTitle: page.seo_title ?? "",
                      seoDescription: page.seo_description ?? "",
                    }}
                    submitting={submitting}
                    formError={formError}
                    onSubmit={(values) => handleUpdate(page.id, values)}
                    onCancel={() => {
                      setEditingId(null);
                      setFormError(null);
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
