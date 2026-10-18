/**
 * Pure helpers for the public published-site routes.
 *
 * Everything here operates on the published bundle returned by
 * `GET /public/portfolios/{slug}` and is intentionally free of I/O so the
 * route handlers stay thin and the URL/metadata rules are unit-testable.
 */

import type { Metadata } from "next";

import type { NavigationLocation } from "@/types/navigation";
import type { PortfolioPreview, PreviewPage } from "@/types/preview";

/** Canonical path of a portfolio's homepage (`/p/{slug}`). */
export function publicHomePath(portfolioSlug: string): string {
  return `/p/${portfolioSlug}`;
}

/** Canonical path of one page; the homepage always uses `/p/{slug}`. */
export function publicPagePath(
  portfolioSlug: string,
  page: PreviewPage,
): string {
  return page.is_homepage
    ? publicHomePath(portfolioSlug)
    : `${publicHomePath(portfolioSlug)}/${page.slug}`;
}

/** Return the snapshot's homepage page, or `undefined` if it is missing. */
export function homepageOf(site: PortfolioPreview): PreviewPage | undefined {
  return site.pages.find((page) => page.is_homepage);
}

/** Look a page up by slug within one published bundle. */
export function pageBySlug(
  site: PortfolioPreview,
  pageSlug: string,
): PreviewPage | undefined {
  return site.pages.find((page) => page.slug === pageSlug);
}

/** One navigation entry resolved to a concrete link target. */
export interface PublicNavEntry {
  id: string;
  label: string;
  /** Internal (`/p/...`) or external URL, or `null` when it cannot resolve. */
  href: string | null;
}

/**
 * Resolve the visible navigation items of one location into link targets.
 * Internal items link to the published route of their page (the homepage
 * collapses onto `/p/{slug}`), external items keep their absolute URL, and an
 * item pointing at a page missing from the snapshot degrades to plain text
 * instead of a broken link.
 */
export function publicNavEntries(
  site: PortfolioPreview,
  location: NavigationLocation,
): PublicNavEntry[] {
  return site.navigation
    .filter((item) => item.is_visible && item.location === location)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      if (item.destination_type === "external_url" && item.external_url) {
        return { id: item.id, label: item.label, href: item.external_url };
      }
      const target = site.pages.find((page) => page.id === item.page_id);
      if (!target) {
        return { id: item.id, label: item.label, href: null };
      }
      return {
        id: item.id,
        label: item.label,
        href: publicPagePath(site.portfolio.slug, target),
      };
    });
}

/**
 * Per-page SEO metadata for a published route: page SEO fields win, then the
 * portfolio description, and the canonical URL always points at the public
 * path the page was resolved from.
 */
export function buildPublicMetadata(
  site: PortfolioPreview,
  page: PreviewPage,
  canonicalPath: string,
): Metadata {
  const title = page.seo_title?.trim() || page.title;
  const description =
    page.seo_description?.trim() ||
    site.portfolio.description?.trim() ||
    undefined;
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: site.portfolio.name,
      type: "website",
    },
  };
}
