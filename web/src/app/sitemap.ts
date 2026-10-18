import type { MetadataRoute } from "next";

import { fetchPublishedSites } from "@/lib/api/publication";
import { siteUrl } from "@/lib/config";

/**
 * Sitemap built exclusively from currently published portfolios via the
 * public sites index, so drafts and unpublished sites are never advertised
 * to crawlers. Page timestamps are the snapshot's copies: they only move
 * forward on republication, matching what the live site actually serves.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 0.5 },
  ];

  let sites;
  try {
    sites = await fetchPublishedSites();
  } catch (error) {
    // Keep the sitemap itself valid when the API is unreachable; the entries
    // simply reflect the last successful crawl.
    console.error("Unable to load published sites for the sitemap:", error);
    return entries;
  }

  for (const site of sites) {
    for (const page of site.pages) {
      const path = page.is_homepage
        ? `/p/${site.slug}`
        : `/p/${site.slug}/${page.slug}`;
      entries.push({
        url: `${base}${path}`,
        lastModified: page.updated_at,
        changeFrequency: page.is_homepage ? "weekly" : "monthly",
        priority: page.is_homepage ? 1 : 0.7,
      });
    }
  }
  return entries;
}
