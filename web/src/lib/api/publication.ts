import { apiFetch } from "@/lib/api/client";
import type { Portfolio, PortfolioStatus } from "@/types/portfolio";
import type { PortfolioPreview } from "@/types/preview";

/**
 * Result of a successful publication. The public path is only ever present
 * after the backend committed the immutable snapshot, so the UI reveals the
 * live URL exclusively on success.
 */
export interface PublishResult {
  status: PortfolioStatus;
  published_at: string;
  version_number: number;
  public_path: string;
}

export function publishPortfolio(id: string): Promise<PublishResult> {
  return apiFetch<PublishResult>(`/portfolios/${id}/publish`, {
    method: "POST",
  });
}

export function unpublishPortfolio(id: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/portfolios/${id}/unpublish`, {
    method: "POST",
  });
}

export function fetchPortfolioPreview(id: string): Promise<PortfolioPreview> {
  return apiFetch<PortfolioPreview>(`/portfolios/${id}/preview`);
}

/**
 * One page of a published site as listed by the public sitemap index.
 * `updated_at` is the snapshot's copy of the page timestamp, so it only moves
 * when the site is republished.
 */
export interface PublishedSitePageSummary {
  slug: string;
  is_homepage: boolean;
  updated_at: string;
}

/** Public sitemap entry for one currently published portfolio. */
export interface PublishedSiteSummary {
  slug: string;
  published_at: string | null;
  pages: PublishedSitePageSummary[];
}

/**
 * Fetch a published site bundle for anonymous public rendering. 404 means the
 * portfolio is unknown, draft, unpublished, or unpublishable — never draft
 * content.
 */
export function fetchPublishedSite(slug: string): Promise<PortfolioPreview> {
  return apiFetch<PortfolioPreview>(
    `/public/portfolios/${encodeURIComponent(slug)}`,
  );
}

/** Fetch every currently published site (sitemap/robots discovery). */
export function fetchPublishedSites(): Promise<PublishedSiteSummary[]> {
  return apiFetch<PublishedSiteSummary[]>("/public/sites");
}
