import { apiFetch } from "@/lib/api/client";
import type { Page, PageCreatePayload, PageUpdatePayload } from "@/types/page";

export function listPages(portfolioId: string): Promise<Page[]> {
  return apiFetch<Page[]>(`/portfolios/${portfolioId}/pages`);
}

export function createPage(
  portfolioId: string,
  payload: PageCreatePayload,
): Promise<Page> {
  return apiFetch<Page>(`/portfolios/${portfolioId}/pages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPage(pageId: string): Promise<Page> {
  return apiFetch<Page>(`/pages/${pageId}`);
}

export function updatePage(
  pageId: string,
  payload: PageUpdatePayload,
): Promise<Page> {
  return apiFetch<Page>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePage(pageId: string): Promise<void> {
  return apiFetch<void>(`/pages/${pageId}`, { method: "DELETE" });
}

export function reorderPages(
  portfolioId: string,
  pageIds: string[],
): Promise<Page[]> {
  return apiFetch<Page[]>(`/portfolios/${portfolioId}/pages/order`, {
    method: "PUT",
    body: JSON.stringify({ page_ids: pageIds }),
  });
}
