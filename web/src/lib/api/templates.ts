import { apiFetch } from "@/lib/api/client";
import type { Template, Theme } from "@/types/theme";

export function listTemplates(): Promise<Template[]> {
  return apiFetch<Template[]>("/templates");
}

export function applyTemplate(
  portfolioId: string,
  templateId: string,
): Promise<Theme> {
  return apiFetch<Theme>(
    `/portfolios/${portfolioId}/templates/${templateId}/apply`,
    { method: "POST" },
  );
}
