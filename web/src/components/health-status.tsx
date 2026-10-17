"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api/health";
import type { HealthResponse } from "@/types/health";

type HealthState =
  | { state: "loading" }
  | { state: "success"; data: HealthResponse }
  | { state: "error"; message: string };

export function HealthStatus() {
  const [health, setHealth] = useState<HealthState>({ state: "loading" });

  const runFetch = useCallback((signal?: AbortSignal) => {
    fetchHealth(signal).then(
      (data) => {
        if (!signal?.aborted) {
          setHealth({ state: "success", data });
        }
      },
      (error: unknown) => {
        if (signal?.aborted) {
          return;
        }
        setHealth({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "An unknown error occurred.",
        });
      },
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    runFetch(controller.signal);
    return () => controller.abort();
  }, [runFetch]);

  const retry = useCallback(() => {
    setHealth({ state: "loading" });
    runFetch();
  }, [runFetch]);

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-lg font-medium">Backend health</h2>

      {health.state === "loading" && (
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Checking the backend…
        </p>
      )}

      {health.state === "success" && (
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-slate-500 dark:text-slate-400">
              Status:
            </dt>
            <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
              {health.data.status}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-slate-500 dark:text-slate-400">
              Service:
            </dt>
            <dd>{health.data.service}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-slate-500 dark:text-slate-400">
              Environment:
            </dt>
            <dd>{health.data.environment}</dd>
          </div>
        </dl>
      )}

      {health.state === "error" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {health.message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
