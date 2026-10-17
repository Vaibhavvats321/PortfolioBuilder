"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { createPortfolio, listPortfolios } from "@/lib/api/portfolios";
import { ApiError } from "@/lib/api/client";
import type { Portfolio } from "@/types/portfolio";

type DashboardState =
  | { state: "loading" }
  | { state: "unauthenticated" }
  | { state: "error"; message: string }
  | { state: "loaded"; portfolios: Portfolio[] };

export function PortfolioDashboard() {
  const [dashboard, setDashboard] = useState<DashboardState>({
    state: "loading",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback((signal?: AbortSignal) => {
    listPortfolios()
      .then((portfolios) => {
        if (signal?.aborted) return;
        setDashboard({ state: "loaded", portfolios });
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          setDashboard({ state: "unauthenticated" });
          return;
        }
        setDashboard({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load portfolios.",
        });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleCreate(values: {
    name: string;
    slug: string;
    description: string;
  }) {
    setCreating(true);
    setCreateError(null);
    try {
      const payload: {
        name: string;
        slug?: string;
        description?: string;
      } = {
        name: values.name,
      };
      if (values.slug) payload.slug = values.slug;
      if (values.description) payload.description = values.description;
      const created = await createPortfolio(payload);
      setShowCreate(false);
      setFormKey((key) => key + 1);
      setDashboard((prev) => {
        if (prev.state !== "loaded") {
          return { state: "loaded", portfolios: [created] };
        }
        return {
          state: "loaded",
          portfolios: [created, ...prev.portfolios],
        };
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setDashboard({ state: "unauthenticated" });
        return;
      }
      setCreateError(
        error instanceof ApiError
          ? error.message
          : "Unable to create portfolio.",
      );
    } finally {
      setCreating(false);
    }
  }

  function handleCancelCreate() {
    setShowCreate(false);
    setCreateError(null);
    setFormKey((key) => key + 1);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">My portfolios</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create and manage your portfolios.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className={buttonClassName("secondary")}>
            Home
          </Link>
          {!showCreate && dashboard.state !== "unauthenticated" ? (
            <Button onClick={() => setShowCreate(true)}>
              Create portfolio
            </Button>
          ) : null}
        </div>
      </header>

      {showCreate && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-medium">New portfolio</h2>
          <div className="mt-4">
            <PortfolioForm
              key={formKey}
              mode="create"
              submitting={creating}
              formError={createError}
              onSubmit={handleCreate}
              onCancel={handleCancelCreate}
            />
          </div>
        </section>
      )}

      {dashboard.state === "loading" && (
        <p className="text-slate-600">Loading portfolios…</p>
      )}

      {dashboard.state === "unauthenticated" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600">
            You must be signed in to view your portfolios.
          </p>
          <div className="flex gap-3">
            <Link href="/login" className={buttonClassName("primary")}>
              Sign in
            </Link>
            <Link href="/register" className={buttonClassName("secondary")}>
              Create account
            </Link>
          </div>
        </div>
      )}

      {dashboard.state === "error" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-rose-600">{dashboard.message}</p>
          <Button variant="secondary" onClick={() => load()}>
            Retry
          </Button>
        </div>
      )}

      {dashboard.state === "loaded" && (
        <>
          {dashboard.portfolios.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-slate-600">
                You don&apos;t have any portfolios yet.
              </p>
              <div className="mt-4">
                <Button onClick={() => setShowCreate(true)}>
                  Create your first portfolio
                </Button>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {dashboard.portfolios.map((portfolio) => (
                <li
                  key={portfolio.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="space-y-2">
                    <h2 className="text-lg font-medium">{portfolio.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      /p/{portfolio.slug}
                    </p>
                    {portfolio.description ? (
                      <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                        {portfolio.description}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        No description
                      </p>
                    )}
                    <p className="text-xs tracking-wide text-slate-400 uppercase">
                      {portfolio.status}
                    </p>
                  </div>
                  <div className="mt-6">
                    <Link
                      href={`/dashboard/portfolios/${portfolio.id}`}
                      className={buttonClassName("secondary", "w-full")}
                    >
                      Manage portfolio
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
