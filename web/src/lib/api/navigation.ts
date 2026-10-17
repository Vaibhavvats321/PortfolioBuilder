import { apiFetch } from "@/lib/api/client";
import type { NavigationItem, NavigationItemInput } from "@/types/navigation";

export function getNavigation(portfolioId: string): Promise<NavigationItem[]> {
  return apiFetch<NavigationItem[]>(`/portfolios/${portfolioId}/navigation`);
}

export function replaceNavigation(
  portfolioId: string,
  items: NavigationItemInput[],
): Promise<NavigationItem[]> {
  return apiFetch<NavigationItem[]>(`/portfolios/${portfolioId}/navigation`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}
