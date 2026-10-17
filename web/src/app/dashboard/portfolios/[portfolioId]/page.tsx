"use client";

import { useParams } from "next/navigation";
import { PortfolioManager } from "@/components/portfolio/portfolio-manager";

export default function PortfolioManagePage() {
  const params = useParams<{ portfolioId: string }>();
  const portfolioId = params.portfolioId;

  if (!portfolioId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-6 py-10">
        <p className="text-slate-600">Portfolio not found.</p>
      </main>
    );
  }

  return <PortfolioManager />;
}
