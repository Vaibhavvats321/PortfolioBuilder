import { apiFetch } from "@/lib/api/client";
import type {
  GlobalLayout,
  GlobalLayoutUpdatePayload,
  Theme,
  ThemeOptions,
  ThemeUpdatePayload,
} from "@/types/theme";

export function getThemeOptions(): Promise<ThemeOptions> {
  return apiFetch<ThemeOptions>("/theme/options");
}

export function getTheme(portfolioId: string): Promise<Theme> {
  return apiFetch<Theme>(`/portfolios/${portfolioId}/theme`);
}

export function updateTheme(
  portfolioId: string,
  payload: ThemeUpdatePayload,
): Promise<Theme> {
  return apiFetch<Theme>(`/portfolios/${portfolioId}/theme`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getGlobalLayout(portfolioId: string): Promise<GlobalLayout> {
  return apiFetch<GlobalLayout>(`/portfolios/${portfolioId}/global-layout`);
}

export function updateGlobalLayout(
  portfolioId: string,
  payload: GlobalLayoutUpdatePayload,
): Promise<GlobalLayout> {
  return apiFetch<GlobalLayout>(`/portfolios/${portfolioId}/global-layout`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
