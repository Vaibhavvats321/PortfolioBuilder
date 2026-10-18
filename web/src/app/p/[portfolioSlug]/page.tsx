import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublishedSite } from "@/components/public/published-site";
import { ApiError } from "@/lib/api/client";
import { fetchPublishedSite } from "@/lib/api/publication";
import { buildPublicMetadata, homepageOf } from "@/lib/public/site";
import type { PortfolioPreview } from "@/types/preview";

// Public pages are served from the published snapshot on every request; the
// backend's own cache handles the read cost while keeping invalidation
// authoritative.
export const dynamic = "force-dynamic";

interface PublicHomeProps {
  params: Promise<{ portfolioSlug: string }>;
}

async function loadPublishedSite(
  portfolioSlug: string,
): Promise<PortfolioPreview> {
  try {
    return await fetchPublishedSite(portfolioSlug);
  } catch (error) {
    // Unknown, draft, unpublished, and corrupt sites all answer 404; the
    // branded not-found page renders instead of leaking any distinction.
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PublicHomeProps): Promise<Metadata> {
  const { portfolioSlug } = await params;
  const site = await loadPublishedSite(portfolioSlug);
  const homepage = homepageOf(site);
  if (!homepage) {
    notFound();
  }
  return buildPublicMetadata(site, homepage, `/p/${site.portfolio.slug}`);
}

export default async function PublicPortfolioHomePage({
  params,
}: PublicHomeProps) {
  const { portfolioSlug } = await params;
  const site = await loadPublishedSite(portfolioSlug);
  const homepage = homepageOf(site);
  if (!homepage) {
    // A published snapshot without a homepage is treated as missing rather
    // than rendering an empty site.
    notFound();
  }
  return <PublishedSite site={site} page={homepage} />;
}
