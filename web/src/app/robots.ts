import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config";

/**
 * Crawler policy: the public site is indexable, while dashboard and auth
 * routes are private and must never be indexed. Draft preview URLs live under
 * `/dashboard/` and are covered by the disallow rules as well as their own
 * `noindex` metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/login", "/register"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
