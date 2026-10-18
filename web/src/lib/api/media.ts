import { apiBaseUrl, apiFetch } from "@/lib/api/client";
import type { MediaAsset, MediaUpdatePayload } from "@/types/media";

export function listMedia(portfolioId: string): Promise<MediaAsset[]> {
  return apiFetch<MediaAsset[]>(`/portfolios/${portfolioId}/media`);
}

export function uploadMedia(
  portfolioId: string,
  file: File,
  metadata: { altText?: string; caption?: string } = {},
): Promise<MediaAsset> {
  const form = new FormData();
  form.append("file", file);
  if (metadata.altText) {
    form.append("alt_text", metadata.altText);
  }
  if (metadata.caption) {
    form.append("caption", metadata.caption);
  }
  return apiFetch<MediaAsset>(`/portfolios/${portfolioId}/media`, {
    method: "POST",
    body: form,
  });
}

export function updateMedia(
  mediaId: string,
  payload: MediaUpdatePayload,
): Promise<MediaAsset> {
  return apiFetch<MediaAsset>(`/media/${mediaId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMedia(mediaId: string): Promise<void> {
  return apiFetch<void>(`/media/${mediaId}`, { method: "DELETE" });
}

/**
 * Absolute URL for an asset's binary file. The endpoint is ownership-checked
 * and served inline, so the browser sends the session cookie for admin preview.
 */
export function mediaFileUrl(mediaId: string): string {
  return `${apiBaseUrl}/media/${mediaId}/file`;
}
