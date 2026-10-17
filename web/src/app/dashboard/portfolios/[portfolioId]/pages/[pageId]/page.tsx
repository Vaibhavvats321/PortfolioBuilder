"use client";

import { useParams } from "next/navigation";
import { PageEditor } from "@/components/builder/page-editor";

export default function PageEditorRoute() {
  const params = useParams<{ portfolioId: string; pageId: string }>();
  const portfolioId = params.portfolioId;
  const pageId = params.pageId;

  if (!portfolioId || !pageId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-6 py-10">
        <p className="text-slate-600">Page not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-6 py-10">
      <PageEditor portfolioId={portfolioId} pageId={pageId} />
    </main>
  );
}
