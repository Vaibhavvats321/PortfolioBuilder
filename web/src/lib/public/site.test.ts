import { describe, expect, it } from "vitest";

import {
  buildPublicMetadata,
  homepageOf,
  pageBySlug,
  publicHomePath,
  publicNavEntries,
  publicPagePath,
} from "@/lib/public/site";
import type { PortfolioPreview, PreviewPage } from "@/types/preview";

function makePage(partial: Partial<PreviewPage> = {}): PreviewPage {
  return {
    id: "page-1",
    title: "Home",
    slug: "home",
    is_homepage: true,
    is_visible: true,
    sort_order: 0,
    seo_title: null,
    seo_description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    sections: [],
    ...partial,
  };
}

function makeSite(): PortfolioPreview {
  return {
    portfolio: {
      id: "portfolio-1",
      name: "Ada's portfolio",
      slug: "ada",
      description: "Ships things.",
      status: "published",
      published_at: "2026-02-01T00:00:00Z",
    },
    pages: [
      makePage(),
      makePage({
        id: "page-2",
        title: "About",
        slug: "about",
        is_homepage: false,
        seo_title: "About Ada",
        seo_description: "Biography.",
      }),
      makePage({
        id: "page-3",
        title: "Hidden",
        slug: "hidden",
        is_homepage: false,
        is_visible: false,
      }),
    ],
    navigation: [],
    theme: { schema_version: 1, tokens: {}, components: {} },
    media: [],
  };
}

describe("public path helpers", () => {
  it("builds canonical paths, collapsing the homepage onto /p/{slug}", () => {
    const site = makeSite();
    const home = homepageOf(site);
    const about = pageBySlug(site, "about");

    expect(home).toBeDefined();
    expect(about).toBeDefined();
    expect(publicHomePath("ada")).toBe("/p/ada");
    expect(publicPagePath("ada", home as PreviewPage)).toBe("/p/ada");
    expect(publicPagePath("ada", about as PreviewPage)).toBe("/p/ada/about");
  });

  it("resolves pages by slug and reports missing ones", () => {
    const site = makeSite();
    expect(homepageOf(site)?.slug).toBe("home");
    expect(pageBySlug(site, "about")?.title).toBe("About");
    expect(pageBySlug(site, "nope")).toBeUndefined();
  });
});

describe("publicNavEntries", () => {
  it("filters by location and visibility, sorts, and resolves link targets", () => {
    const site = makeSite();
    site.navigation = [
      {
        id: "nav-2",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "About",
        destination_type: "page",
        page_id: "page-2",
        external_url: null,
        sort_order: 1,
        is_visible: true,
      },
      {
        id: "nav-1",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "Home",
        destination_type: "page",
        page_id: "page-1",
        external_url: null,
        sort_order: 0,
        is_visible: true,
      },
      {
        id: "nav-3",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "Secret",
        destination_type: "page",
        page_id: "page-3",
        external_url: null,
        sort_order: 2,
        is_visible: false,
      },
      {
        id: "nav-4",
        portfolio_id: "portfolio-1",
        location: "footer",
        label: "Blog",
        destination_type: "external_url",
        page_id: null,
        external_url: "https://blog.example.com",
        sort_order: 0,
        is_visible: true,
      },
      {
        id: "nav-5",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "Orphan",
        destination_type: "page",
        page_id: "page-404",
        external_url: null,
        sort_order: 3,
        is_visible: true,
      },
    ];

    const header = publicNavEntries(site, "header");
    expect(header.map((entry) => entry.label)).toEqual([
      "Home",
      "About",
      "Orphan",
    ]);
    const [homeEntry, aboutEntry, orphanEntry] = header;
    // The homepage entry collapses to the canonical public home path.
    expect(homeEntry?.href).toBe("/p/ada");
    expect(aboutEntry?.href).toBe("/p/ada/about");
    // An item pointing at a page missing from the snapshot degrades to text.
    expect(orphanEntry?.href).toBeNull();

    const footer = publicNavEntries(site, "footer");
    expect(footer).toEqual([
      { id: "nav-4", label: "Blog", href: "https://blog.example.com" },
    ]);
  });
});

describe("buildPublicMetadata", () => {
  it("prefers page SEO fields and falls back to portfolio data", () => {
    const site = makeSite();
    const about = pageBySlug(site, "about") as PreviewPage;
    const home = homepageOf(site) as PreviewPage;

    const aboutMeta = buildPublicMetadata(site, about, "/p/ada/about");
    expect(aboutMeta.title).toBe("About Ada");
    expect(aboutMeta.description).toBe("Biography.");
    expect(aboutMeta.alternates).toEqual({ canonical: "/p/ada/about" });
    expect(aboutMeta.robots).toEqual({ index: true, follow: true });
    expect(aboutMeta.openGraph).toMatchObject({
      title: "About Ada",
      description: "Biography.",
      url: "/p/ada/about",
      siteName: "Ada's portfolio",
      type: "website",
    });

    const homeMeta = buildPublicMetadata(site, home, "/p/ada");
    expect(homeMeta.title).toBe("Home");
    // Without page SEO fields the portfolio description carries through.
    expect(homeMeta.description).toBe("Ships things.");
  });

  it("drops the description when neither layer defines one", () => {
    const site = makeSite();
    site.portfolio.description = null;
    const home = homepageOf(site) as PreviewPage;
    const meta = buildPublicMetadata(site, home, "/p/ada");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph?.description).toBeUndefined();
  });
});
