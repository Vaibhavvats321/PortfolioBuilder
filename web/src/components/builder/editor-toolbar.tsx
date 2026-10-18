"use client";

import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import type { PortfolioStatus } from "@/types/portfolio";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface ToolbarPublication {
  /** `null` while the portfolio's status is unknown (fetch pending/failed). */
  status: PortfolioStatus | null;
  publishing: boolean;
  error: string | null;
  /** Set only after a successful publish in this session. */
  result: { version: number; publicPath: string } | null;
}

interface EditorToolbarProps {
  portfolioId: string;
  saveStatus: SaveStatus;
  dirty: boolean;
  hasErrors: boolean;
  onSaveDraft: () => void;
  publication?: ToolbarPublication;
  onPublish?: () => void;
}

function publicUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

/**
 * Page editor toolbar row: live draft-save status, an explicit Save Draft
 * action that flushes the inspector's pending edits, the publish action, and
 * the link to the protected draft preview.
 *
 * Save Draft is blocked while the form has validation errors. Publish is
 * blocked while edits are unsaved or a save is in flight, so a snapshot can
 * never capture older content than what the editor shows; the public path is
 * revealed only after the backend committed the version.
 */
export function EditorToolbar({
  portfolioId,
  saveStatus,
  dirty,
  hasErrors,
  onSaveDraft,
  publication = { status: null, publishing: false, error: null, result: null },
  onPublish,
}: EditorToolbarProps) {
  const saving = saveStatus === "saving";
  const statusText = saving
    ? "Saving…"
    : saveStatus === "error"
      ? "Save failed"
      : dirty
        ? hasErrors
          ? "Unsaved changes — fix validation errors first"
          : "Unsaved changes"
        : saveStatus === "saved"
          ? "All changes saved"
          : "No changes yet";
  const statusClassName = saving
    ? "text-slate-500 dark:text-slate-400"
    : saveStatus === "error"
      ? "text-rose-600 dark:text-rose-400"
      : dirty
        ? "text-amber-600 dark:text-amber-400"
        : saveStatus === "saved"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-slate-500 dark:text-slate-400";
  const publishLabel = publication.publishing
    ? "Publishing…"
    : publication.status === "published"
      ? "Publish changes"
      : "Publish";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className={`text-sm font-medium ${statusClassName}`}>
          {statusText}
        </p>
        {publication.result ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Version {publication.result.version} is live at{" "}
            <a
              href={publicUrl(publication.result.publicPath)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {publication.result.publicPath}
            </a>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSaveDraft} disabled={!dirty || hasErrors || saving}>
          Save Draft
        </Button>
        <Button
          variant="secondary"
          onClick={onPublish}
          disabled={publication.publishing || saving || dirty || !onPublish}
        >
          {publishLabel}
        </Button>
        <Link
          href={`/dashboard/portfolios/${portfolioId}/preview`}
          className={buttonClassName("secondary")}
        >
          Preview
        </Link>
      </div>
      {publication.error ? (
        <p
          role="alert"
          className="basis-full text-sm text-rose-600 dark:text-rose-400"
        >
          {publication.error}
        </p>
      ) : null}
    </div>
  );
}
