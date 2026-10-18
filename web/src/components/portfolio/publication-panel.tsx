"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  publishPortfolio,
  unpublishPortfolio,
  type PublishResult,
} from "@/lib/api/publication";
import { fetchPortfolio } from "@/lib/api/portfolios";
import { ApiError } from "@/lib/api/client";
import type { Portfolio } from "@/types/portfolio";

interface PublicationPanelProps {
  portfolio: Portfolio;
  onChanged: (portfolio: Portfolio) => void;
}

function publicUrl(portfolio: Portfolio): string {
  if (typeof window === "undefined") return `/p/${portfolio.slug}`;
  return `${window.location.origin}/p/${portfolio.slug}`;
}

/**
 * Publication controls for the portfolio overview: a draft/published status
 * badge, publish and unpublish actions, and the public URL shown only once
 * the portfolio is actually published. Validation failures surface the
 * backend's error message and leave the previous published version active.
 */
export function PublicationPanel({
  portfolio,
  onChanged,
}: PublicationPanelProps) {
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handlePublish() {
    setBusy("publish");
    setError(null);
    setNotice(null);
    try {
      const result: PublishResult = await publishPortfolio(portfolio.id);
      const updated = await fetchPortfolio(portfolio.id);
      onChanged(updated);
      setNotice(`Published version ${result.version_number}.`);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to publish.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleUnpublish() {
    setBusy("unpublish");
    setError(null);
    setNotice(null);
    try {
      const updated = await unpublishPortfolio(portfolio.id);
      onChanged(updated);
      setConfirmingUnpublish(false);
      setNotice("Unpublished. The public URL is no longer served.");
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to unpublish.",
      );
      setConfirmingUnpublish(false);
    } finally {
      setBusy(null);
    }
  }

  const published = portfolio.status === "published";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Publication</h2>
          <div className="flex items-center gap-2">
            <span
              className={
                published
                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              {published ? "Published" : "Draft"}
            </span>
            {published && portfolio.published_at ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(portfolio.published_at).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        {!published ? (
          <Button onClick={handlePublish} disabled={busy !== null}>
            {busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
        ) : null}
      </div>

      {published ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your portfolio is live at{" "}
            <a
              href={publicUrl(portfolio)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {publicUrl(portfolio)}
            </a>
          </p>
          {!confirmingUnpublish ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmingUnpublish(true)}
              disabled={busy !== null}
            >
              Unpublish
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Unpublishing removes the public pages immediately. Published
                versions stay in your history and you can publish again at any
                time.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleUnpublish} disabled={busy !== null}>
                  {busy === "unpublish" ? "Unpublishing…" : "Yes, unpublish"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingUnpublish(false)}
                  disabled={busy !== null}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Publishing validates your pages, navigation, and theme, then freezes
          an immutable snapshot. Visitors only ever see published versions.
        </p>
      )}

      {notice ? (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
