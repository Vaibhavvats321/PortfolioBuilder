import { apiFetch } from "@/lib/api/client";
import type {
  PageSection,
  SectionCreatePayload,
  SectionType,
  SectionUpdatePayload,
} from "@/types/section";

export function listSectionTypes(): Promise<SectionType[]> {
  return apiFetch<SectionType[]>("/section-types");
}

export function listSections(pageId: string): Promise<PageSection[]> {
  return apiFetch<PageSection[]>(`/pages/${pageId}/sections`);
}

export function createSection(
  pageId: string,
  payload: SectionCreatePayload,
): Promise<PageSection> {
  return apiFetch<PageSection>(`/pages/${pageId}/sections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSection(sectionId: string): Promise<PageSection> {
  return apiFetch<PageSection>(`/sections/${sectionId}`);
}

export function updateSection(
  sectionId: string,
  payload: SectionUpdatePayload,
): Promise<PageSection> {
  return apiFetch<PageSection>(`/sections/${sectionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSection(sectionId: string): Promise<void> {
  return apiFetch<void>(`/sections/${sectionId}`, { method: "DELETE" });
}

export function duplicateSection(sectionId: string): Promise<PageSection> {
  return apiFetch<PageSection>(`/sections/${sectionId}/duplicate`, {
    method: "POST",
  });
}

export function reorderSections(
  pageId: string,
  sectionIds: string[],
): Promise<PageSection[]> {
  return apiFetch<PageSection[]>(`/pages/${pageId}/sections/order`, {
    method: "PUT",
    body: JSON.stringify({ section_ids: sectionIds }),
  });
}
