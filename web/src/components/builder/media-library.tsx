"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api/client";
import {
  deleteMedia,
  listMedia,
  mediaFileUrl,
  updateMedia,
  uploadMedia,
} from "@/lib/api/media";
import type { MediaAsset } from "@/types/media";

type MediaLoad =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; assets: MediaAsset[] };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface MediaLibraryProps {
  portfolioId: string;
}

/**
 * Portfolio media library: lists uploaded assets with their metadata, supports
 * upload, alt-text/caption editing, client-side search, and deletion. Every
 * successful mutation refreshes the list so the view reflects server state.
 */
export function MediaLibrary({ portfolioId }: MediaLibraryProps) {
  const [load, setLoad] = useState<MediaLoad>({ state: "loading" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
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
            message: errorMessage(error, "Unable to load media assets."),
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

  const assets = load.state === "loaded" ? load.assets : [];

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadMedia(portfolioId, file);
      setLoad((prev) =>
        prev.state === "loaded"
          ? { state: "loaded", assets: [created, ...prev.assets] }
          : prev,
      );
      refresh();
    } catch (error: unknown) {
      setUploadError(errorMessage(error, "Upload failed."));
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

  async function handleDelete(mediaId: string) {
    setBusyId(mediaId);
    setActionError(null);
    try {
      await deleteMedia(mediaId);
      setLoad((prev) =>
        prev.state === "loaded"
          ? {
              state: "loaded",
              assets: prev.assets.filter((asset) => asset.id !== mediaId),
            }
          : prev,
      );
      setConfirmDeleteId(null);
      refresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error, "Delete failed."));
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(asset: MediaAsset) {
    setEditingId(asset.id);
    setEditAlt(asset.alt_text ?? "");
    setEditCaption(asset.caption ?? "");
    setActionError(null);
  }

  async function saveEdit(mediaId: string) {
    setBusyId(mediaId);
    setActionError(null);
    try {
      const updated = await updateMedia(mediaId, {
        alt_text: editAlt,
        caption: editCaption,
      });
      setLoad((prev) =>
        prev.state === "loaded"
          ? {
              state: "loaded",
              assets: prev.assets.map((asset) =>
                asset.id === mediaId ? updated : asset,
              ),
            }
          : prev,
      );
      setEditingId(null);
      refresh();
    } catch (error: unknown) {
      setActionError(errorMessage(error, "Update failed."));
    } finally {
      setBusyId(null);
    }
  }

  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? assets.filter(
        (asset) =>
          asset.original_filename.toLowerCase().includes(needle) ||
          (asset.alt_text ?? "").toLowerCase().includes(needle) ||
          (asset.caption ?? "").toLowerCase().includes(needle),
      )
    : assets;

  return (
    <div className="space-y-4" data-testid="media-library">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="media-search" className="sr-only">
            Search media
          </label>
          <input
            id="media-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search filename or alt text…"
            className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {load.state === "loaded" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} of {assets.length} asset
              {assets.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="secondary"
            onClick={() => refresh()}
            disabled={load.state === "loading"}
          >
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Images up to 10 MB (JPEG, PNG, GIF, WebP, SVG). Files are scoped to this
        portfolio only.
      </p>

      {uploadError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {uploadError}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      {load.state === "loading" ? (
        <p className="text-sm text-slate-600 dark:text-slate-400" role="status">
          Loading media assets…
        </p>
      ) : load.state === "error" ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
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
      ) : filtered.length === 0 ? (
        <div
          className="rounded-md border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"
          data-testid="media-empty"
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {assets.length === 0
              ? "No media uploaded yet. Upload an image to get started."
              : "No assets match your search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <li
              key={asset.id}
              className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              data-testid="media-item"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated admin preview of uploaded media */}
              <img
                src={mediaFileUrl(asset.id)}
                alt={asset.alt_text ?? asset.original_filename}
                className="h-40 w-full rounded object-cover"
              />
              <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                  {asset.original_filename}
                </p>
                <p>
                  {asset.width && asset.height
                    ? `${asset.width} × ${asset.height}px · `
                    : ""}
                  {asset.mime_type} · {formatBytes(asset.size_bytes)}
                </p>
                {asset.alt_text ? <p>Alt: {asset.alt_text}</p> : null}
                {asset.caption ? <p>Caption: {asset.caption}</p> : null}
              </div>

              {editingId === asset.id ? (
                <div className="mt-3 space-y-2">
                  <TextField
                    id={`alt-${asset.id}`}
                    label="Alt text"
                    value={editAlt}
                    onChange={(event) => setEditAlt(event.target.value)}
                  />
                  <TextField
                    id={`caption-${asset.id}`}
                    label="Caption"
                    value={editCaption}
                    onChange={(event) => setEditCaption(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveEdit(asset.id)}
                      disabled={busyId === asset.id}
                    >
                      {busyId === asset.id ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      disabled={busyId === asset.id}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => startEdit(asset)}>
                    Edit metadata
                  </Button>
                  {confirmDeleteId === asset.id ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleDelete(asset.id)}
                        disabled={busyId === asset.id}
                      >
                        {busyId === asset.id ? "Deleting…" : "Confirm"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={busyId === asset.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmDeleteId(asset.id)}
                      aria-label={`Delete ${asset.original_filename}`}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
