export const PAGE_TITLE_MAX_LENGTH = 200;
export const PAGE_SLUG_MAX_LENGTH = 100;
export const PAGE_SEO_TITLE_MAX_LENGTH = 200;
export const PAGE_SEO_DESCRIPTION_MAX_LENGTH = 500;
export const NAVIGATION_LABEL_MAX_LENGTH = 120;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validatePageTitle(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Title is required.";
  }
  if (trimmed.length > PAGE_TITLE_MAX_LENGTH) {
    return `Title must be at most ${PAGE_TITLE_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validatePageSlug(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined; // optional; derived from the title
  }
  const lower = trimmed.toLowerCase();
  if (lower.length > PAGE_SLUG_MAX_LENGTH) {
    return `Slug must be at most ${PAGE_SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(lower)) {
    return "Use lowercase letters, numbers, and single hyphens only.";
  }
  return undefined;
}

export function validateSeoTitle(value: string): string | undefined {
  if (value.trim().length > PAGE_SEO_TITLE_MAX_LENGTH) {
    return `SEO title must be at most ${PAGE_SEO_TITLE_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validateSeoDescription(value: string): string | undefined {
  if (value.trim().length > PAGE_SEO_DESCRIPTION_MAX_LENGTH) {
    return `SEO description must be at most ${PAGE_SEO_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validateNavigationLabel(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Label is required.";
  }
  if (trimmed.length > NAVIGATION_LABEL_MAX_LENGTH) {
    return `Label must be at most ${NAVIGATION_LABEL_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validateExternalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "A URL is required for an external link.";
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a valid http or https URL.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Enter a valid http or https URL.";
  }
  return undefined;
}
