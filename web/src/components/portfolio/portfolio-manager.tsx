"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { PageManager } from "@/components/portfolio/page-manager";
import { NavigationManager } from "@/components/portfolio/navigation-manager";
import { PublicationPanel } from "@/components/portfolio/publication-panel";
import { DesignStudio } from "@/components/design/design-studio";
import { MediaLibrary } from "@/components/builder/media-library";
import {
  deletePortfolio,
  fetchPortfolio,
  updatePortfolio,
} from "@/lib/api/portfolios";
import { ApiError } from "@/lib/api/client";
import type { Portfolio } from "@/types/portfolio";

type ManagerState =
  | { state: "loading" }
  | { state: "unauthenticated" }
  | { state: "not-found" }
  | { state: "error"; message: string }
  | { state: "loaded"; portfolio: Portfolio };

type ManagerTab = "details" | "pages" | "navigation" | "design" | "media";

const TABS: { id: ManagerTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "pages", label: "Pages" },
  { id: "navigation", label: "Navigation" },
  { id: "design", label: "Design" },
  { id: "media", label: "Media" },
];

export function PortfolioManager() {
  const params = useParams<{ portfolioId: string }>();
  const portfolioId = params.portfolioId;
  const router = useRouter();
  const [manager, setManager] = useState<ManagerState>({ state: "loading" });
  const [tab, setTab] = useState<ManagerTab>("details");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!portfolioId) {
        setManager({ state: "not-found" });
        return;
      }
      fetchPortfolio(portfolioId)
        .then((portfolio) => {
          if (signal?.aborted) return;
          setManager({ state: "loaded", portfolio });
          setFormError(null);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          if (error instanceof ApiError) {
            if (error.status === 401) {
              setManager({ state: "unauthenticated" });
              return;
            }
            if (error.status === 404) {
              setManager({ state: "not-found" });
              return;
            }
          }
          setManager({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load portfolio.",
          });
        });
    },
    [portfolioId],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleUpdate(values: {
    name: string;
    slug: string;
    description: string;
  }) {
    if (manager.state !== "loaded") return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: {
        name: string;
        slug: string;
        description: string | null;
      } = {
        name: values.name,
        slug: values.slug,
        description: values.description ? values.description : null,
      };
      const updated = await updatePortfolio(manager.portfolio.id, payload);
      setManager({ state: "loaded", portfolio: updated });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setManager({ state: "unauthenticated" });
        return;
      }
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to update portfolio.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (manager.state !== "loaded") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePortfolio(manager.portfolio.id);
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setManager({ state: "unauthenticated" });
        return;
      }
      setDeleteError(
        error instanceof ApiError
          ? error.message
          : "Unable to delete portfolio.",
      );
      setShowConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Portfolio management</h1>
          <Link
            href={`/dashboard/portfolios/${portfolioId}/preview`}
            className={buttonClassName("secondary")}
          >
            Open draft preview
          </Link>
        </div>
      </header>

      {manager.state === "loading" && (
        <p className="text-slate-600">Loading portfolio…</p>
      )}

      {manager.state === "unauthenticated" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            You must be signed in to manage this portfolio.
          </p>
          <Link href="/login" className={buttonClassName("primary")}>
            Sign in
          </Link>
        </div>
      )}

      {manager.state === "not-found" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">Portfolio not found.</p>
          <Link href="/dashboard" className={buttonClassName("secondary")}>
            Back to dashboard
          </Link>
        </div>
      )}

      {manager.state === "error" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-rose-600">{manager.message}</p>
          <Button variant="secondary" onClick={() => load()}>
            Retry
          </Button>
        </div>
      )}

      {manager.state === "loaded" && (
        <div className="space-y-6">
          <nav className="flex flex-wrap gap-2" aria-label="Portfolio sections">
            {TABS.map((item) => (
              <Button
                key={item.id}
                variant={tab === item.id ? "primary" : "secondary"}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </nav>

          {tab === "details" ? (
            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-medium">Edit metadata</h2>
                <div className="mt-4">
                  <PortfolioForm
                    mode="edit"
                    initialValues={{
                      name: manager.portfolio.name,
                      slug: manager.portfolio.slug,
                      description: manager.portfolio.description ?? "",
                    }}
                    submitting={saving}
                    formError={formError}
                    onSubmit={handleUpdate}
                  />
                </div>
              </section>

              <aside className="space-y-4">
                <PublicationPanel
                  portfolio={manager.portfolio}
                  onChanged={(portfolio) =>
                    setManager({ state: "loaded", portfolio })
                  }
                />

                <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-medium text-rose-700">
                    Delete portfolio
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    This action cannot be undone.
                  </p>
                  {deleteError ? (
                    <p className="mt-3 text-sm text-rose-600">{deleteError}</p>
                  ) : null}
                  {!showConfirmDelete ? (
                    <div className="mt-4">
                      <Button
                        variant="secondary"
                        onClick={() => setShowConfirmDelete(true)}
                      >
                        Delete portfolio
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-700">
                        Are you sure you want to permanently delete{" "}
                        <span className="font-medium">
                          {manager.portfolio.name}
                        </span>
                        ?
                      </p>
                      <div className="flex gap-3">
                        <Button
                          variant="primary"
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting…" : "Yes, delete"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setShowConfirmDelete(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </aside>
            </div>
          ) : null}

          {tab === "pages" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-medium">Pages</h2>
              <PageManager portfolioId={portfolioId} />
            </section>
          ) : null}

          {tab === "navigation" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-medium">Navigation</h2>
              <NavigationManager portfolioId={portfolioId} />
            </section>
          ) : null}

          {tab === "design" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-medium">Design studio</h2>
              <DesignStudio portfolioId={portfolioId} />
            </section>
          ) : null}

          {tab === "media" ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-medium">Media Library</h2>
              <MediaLibrary portfolioId={portfolioId} />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
