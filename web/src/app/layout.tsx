import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Portfolio Builder",
  description: "Create, customize, and publish your own portfolio website.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
