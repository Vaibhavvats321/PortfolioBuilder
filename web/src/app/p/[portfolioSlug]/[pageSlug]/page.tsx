import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PublishedSite } from "@/components/public/published-site";
import { ApiError } from "@/lib/api/client";
import { fetchPublishedSite } from "@/lib/api/publication";
import {
  buildPublicMetadata,
  pageBySlug,
  publicHomePath,
} from "@/lib/public/site";
import type { PortfolioPreview } from "@/types/preview";

export const dynamic = "force-dynamic";

interface PublicPageProps {
  params: Promise<{ portfolioSlug: string; pageSlug: string }>;
}

async function loadPublishedSite(
  portfolioSlug: string,
): Promise<PortfolioPreview> {
  try {
    return await fetchPublishedSite(portfolioSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PublicPageProps): Promise<Metadata> {
  const { portfolioSlug, pageSlug } = await params;
  const site = await loadPublishedSite(portfolioSlug);
  const page = pageBySlug(site, pageSlug);
  if (!page) {
    notFound();
  }
  const canonical = page.is_homepage
    ? `/p/${site.portfolio.slug}`
    : `/p/${site.portfolio.slug}/${page.slug}`;
  return buildPublicMetadata(site, page, canonical);
}

export default async function PublicPortfolioPage({ params }: PublicPageProps) {
  const { portfolioSlug, pageSlug } = await params;
  const site = await loadPublishedSite(portfolioSlug);
  const page = pageBySlug(site, pageSlug);
  if (!page) {
    // A slug that is not part of the published snapshot renders the branded
    // 404. Pages hidden from navigation stay routable here by design.
    notFound();
  }
  if (page.is_homepage) {
    // The homepage only lives at /p/{slug}; keep its canonical URL stable.
    redirect(publicHomePath(site.portfolio.slug));
  }
  return <PublishedSite site={site} page={page} />;
}
