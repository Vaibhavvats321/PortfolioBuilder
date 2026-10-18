const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * Absolute origin of this web app, used to build canonical URLs, Open Graph
 * URLs, sitemap entries, and the robots sitemap pointer. Overridable with
 * `NEXT_PUBLIC_SITE_URL` in the frontend environment.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(
    /\/+$/,
    "",
  );
}
