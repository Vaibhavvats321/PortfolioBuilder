// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { PublishedSite } from "@/components/public/published-site";
import type { PortfolioPreview, PreviewPage } from "@/types/preview";
import type { PageSection } from "@/types/section";

afterEach(() => {
  cleanup();
});

function makeSection(partial: Partial<PageSection> = {}): PageSection {
  return {
    id: "section-1",
    page_id: "page-1",
    section_type: "hero",
    name: "Hero",
    sort_order: 0,
    is_visible: true,
    content: { heading: "Welcome to Ada" },
    layout: {},
    style: {},
    schema_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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
      {
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
        sections: [
          makeSection(),
          makeSection({
            id: "section-2",
            name: "Hidden",
            content: { heading: "Secret heading" },
            is_visible: false,
          }),
        ],
      },
    ],
    navigation: [
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
        id: "nav-2",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "Blog",
        destination_type: "external_url",
        page_id: null,
        external_url: "https://blog.example.com",
        sort_order: 1,
        is_visible: true,
      },
      {
        id: "nav-3",
        portfolio_id: "portfolio-1",
        location: "header",
        label: "Secret link",
        destination_type: "page",
        page_id: "page-1",
        external_url: null,
        sort_order: 2,
        is_visible: false,
      },
      {
        id: "nav-4",
        portfolio_id: "portfolio-1",
        location: "sidebar",
        label: "Home",
        destination_type: "page",
        page_id: "page-1",
        external_url: null,
        sort_order: 0,
        is_visible: true,
      },
      {
        id: "nav-5",
        portfolio_id: "portfolio-1",
        location: "footer",
        label: "About",
        destination_type: "page",
        page_id: "page-999",
        external_url: null,
        sort_order: 0,
        is_visible: true,
      },
    ],
    theme: {
      schema_version: 1,
      tokens: {},
      components: {
        branding: { logo_text: "Ada" },
        footer: { copyright: "© 2026 Ada", layout: "columns" },
        sidebar: { visible: true, position: "left", width: "narrow" },
      },
    },
    media: [],
  };
}

function homePage(site: PortfolioPreview): PreviewPage {
  const page = site.pages.find((candidate) => candidate.is_homepage);
  if (!page) throw new Error("missing fixture homepage");
  return page;
}

describe("PublishedSite", () => {
  it("renders the published page sections and hides invisible ones", () => {
    const site = makeSite();
    render(<PublishedSite site={site} page={homePage(site)} />);

    expect(
      screen.getByRole("heading", { name: "Welcome to Ada" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Secret heading")).toBeNull();
    // This is a published view: no editor scaffolding or draft banner.
    expect(screen.queryByText(/draft preview/i)).toBeNull();
  });

  it("builds internal navigation links against the canonical public paths", () => {
    const site = makeSite();
    render(<PublishedSite site={site} page={homePage(site)} />);

    const homeLink = screen.getAllByRole("link", { name: "Home" });
    // Brand link (header) and the sidebar entry both resolve to /p/ada.
    expect(homeLink[0]).toHaveAttribute("href", "/p/ada");

    const blog = screen.getByRole("link", { name: "Blog" });
    expect(blog).toHaveAttribute("href", "https://blog.example.com");

    // Invisible items drop out of the rendered navigation entirely.
    expect(screen.queryByText("Secret link")).toBeNull();

    // A footer item whose page is missing from the snapshot renders as text.
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByRole("link", { name: "About" })).toBeNull();
    expect(within(footer).getByText("About")).toBeInTheDocument();
    expect(within(footer).getByText("© 2026 Ada")).toBeInTheDocument();
  });

  it("renders the sidebar when the layout enables it", () => {
    const site = makeSite();
    render(<PublishedSite site={site} page={homePage(site)} />);

    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/p/ada",
    );
  });

  it("omits chrome the layout disables", () => {
    const site = makeSite();
    site.theme.components = {
      header: { visible: false },
      footer: { visible: false },
      sidebar: { visible: false },
      branding: { logo_text: "Ada" },
    };
    render(<PublishedSite site={site} page={homePage(site)} />);

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    // Sections still render with the chrome hidden.
    expect(
      screen.getByRole("heading", { name: "Welcome to Ada" }),
    ).toBeInTheDocument();
  });
});
