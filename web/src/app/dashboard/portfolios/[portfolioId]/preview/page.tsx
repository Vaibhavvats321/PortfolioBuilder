import type { Metadata } from "next";

import { DraftPreview } from "@/components/builder/draft-preview";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

interface PreviewPageProps {
  params: Promise<{ portfolioId: string }>;
}

/**
 * Protected draft preview route. The page itself only shells out to the
 * client component that fetches the live draft bundle with the owner's
 * session; `robots` metadata marks the route `noindex, nofollow` so search
 * engines never index draft content even if the URL leaks.
 */
export default async function PortfolioPreviewPage({
  params,
}: PreviewPageProps) {
  const { portfolioId } = await params;
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <DraftPreview portfolioId={portfolioId} />
    </>
  );
}
