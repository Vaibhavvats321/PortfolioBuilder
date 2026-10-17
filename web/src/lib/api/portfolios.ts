import { apiFetch } from "@/lib/api/client";
import type {
  Portfolio,
  PortfolioCreatePayload,
  PortfolioUpdatePayload,
} from "@/types/portfolio";

export function listPortfolios(): Promise<Portfolio[]> {
  return apiFetch<Portfolio[]>("/portfolios");
}

export function createPortfolio(
  payload: PortfolioCreatePayload,
): Promise<Portfolio> {
  return apiFetch<Portfolio>("/portfolios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPortfolio(id: string): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/portfolios/${id}`);
}

export function updatePortfolio(
  id: string,
  payload: PortfolioUpdatePayload,
): Promise<Portfolio> {
  return apiFetch<Portfolio>(`/portfolios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePortfolio(id: string): Promise<void> {
  return apiFetch<void>(`/portfolios/${id}`, { method: "DELETE" });
}
