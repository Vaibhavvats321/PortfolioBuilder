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
