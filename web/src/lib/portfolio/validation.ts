export const PORTFOLIO_NAME_MAX_LENGTH = 120;
export const PORTFOLIO_SLUG_MAX_LENGTH = 100;
export const PORTFOLIO_DESCRIPTION_MAX_LENGTH = 500;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validatePortfolioName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Name is required.";
  }
  if (trimmed.length > PORTFOLIO_NAME_MAX_LENGTH) {
    return `Name must be at most ${PORTFOLIO_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validatePortfolioSlug(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined; // optional; derived from the name
  }
  const lower = trimmed.toLowerCase();
  if (lower.length > PORTFOLIO_SLUG_MAX_LENGTH) {
    return `Slug must be at most ${PORTFOLIO_SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(lower)) {
    return "Use lowercase letters, numbers, and single hyphens only.";
  }
  return undefined;
}

export function validatePortfolioDescription(
  value: string,
): string | undefined {
  if (value.trim().length > PORTFOLIO_DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${PORTFOLIO_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return undefined;
}
