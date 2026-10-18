"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { listMedia, mediaFileUrl, uploadMedia } from "@/lib/api/media";
import type { MediaAsset } from "@/types/media";

type PickerLoad =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; assets: MediaAsset[] };

interface MediaPickerProps {
  portfolioId: string;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for choosing a portfolio media asset. It loads the portfolio's
 * library on mount, supports uploading from within the dialog (the new asset
 * is selected immediately), and closes on backdrop click, Escape, or explicit
 * cancel. Focus moves into the dialog on open and returns to the trigger on
 * unmount.
 */
export function MediaPicker({
  portfolioId,
  onClose,
  onSelect,
}: MediaPickerProps) {
  const [load, setLoad] = useState<PickerLoad>({ state: "loading" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      listMedia(portfolioId)
        .then((assets) => {
          if (signal?.aborted) return;
          setLoad({ state: "loaded", assets });
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setLoad({
            state: "error",
            message:
              error instanceof ApiError
                ? error.message
                : "Unable to load media assets.",
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

  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadMedia(portfolioId, file);
      onSelect(created);
    } catch (error: unknown) {
      setUploadError(
        error instanceof ApiError ? error.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): void {
    const file = event.target.files?.[0];
    if (file) void handleUpload(file);
  }

  const assets = load.state === "loaded" ? load.assets : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      data-testid="media-picker-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        data-testid="media-picker"
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="media-picker-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Choose an image
          </h2>
          <Button variant="secondary" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Upload image file"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload image"}
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Images up to 10 MB. The uploaded image is selected automatically.
          </p>
        </div>

        {uploadError ? (
          <p
            role="alert"
            className="mt-3 text-sm text-rose-600 dark:text-rose-400"
          >
            {uploadError}
          </p>
        ) : null}

        <div className="mt-4">
          {load.state === "loading" ? (
            <p
              role="status"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              Loading media assets…
            </p>
          ) : load.state === "error" ? (
            <div className="space-y-3">
              <p
                role="alert"
                className="text-sm text-rose-600 dark:text-rose-400"
              >
                {load.message}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setLoad({ state: "loading" });
                  refresh();
                }}
              >
                Retry
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No media uploaded yet. Upload an image to get started.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(asset)}
                    aria-label={`Select ${asset.original_filename}`}
                    className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 p-2 text-left hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none dark:border-slate-700 dark:hover:border-slate-500"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated admin preview of uploaded media */}
                    <img
                      src={mediaFileUrl(asset.id)}
                      alt=""
                      className="h-24 w-full rounded object-cover"
                    />
                    <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                      {asset.original_filename}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {asset.width && asset.height
                        ? `${asset.width} × ${asset.height}px · `
                        : ""}
                      {asset.mime_type}
                    </span>
                    {asset.alt_text ? (
                      <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        Alt: {asset.alt_text}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface MediaPickerButtonProps {
  portfolioId: string;
  onSelect: (asset: MediaAsset) => void;
  label?: string;
}

/**
 * "Browse media" trigger for image fields. Mounts the picker dialog while
 * open; on selection it closes and hands the asset back to the field.
 */
export function MediaPickerButton({
  portfolioId,
  onSelect,
  label = "Browse media…",
}: MediaPickerButtonProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <MediaPicker
        portfolioId={portfolioId}
        onClose={() => setOpen(false)}
        onSelect={(asset) => {
          setOpen(false);
          onSelect(asset);
        }}
      />
    </>
  );
}
