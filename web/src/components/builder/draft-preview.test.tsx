// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { DraftPreview } from "@/components/builder/draft-preview";
import { ApiError } from "@/lib/api/client";
import { fetchPortfolioPreview } from "@/lib/api/publication";
import { listSectionTypes } from "@/lib/api/sections";
import type { PortfolioPreview } from "@/types/preview";
import type { PageSection, SectionType } from "@/types/section";

vi.mock("@/lib/api/publication", () => ({
  fetchPortfolioPreview: vi.fn(),
  publishPortfolio: vi.fn(),
  unpublishPortfolio: vi.fn(),
}));

vi.mock("@/lib/api/sections", () => ({
  listSectionTypes: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const HERO_TYPE: SectionType = {
  type_id: "hero",
  label: "Hero",
  description: "",
  group: "Content",
  schema_version: 1,
  content_fields: [],
  layout_fields: [],
  style_fields: [],
  default_content: {},
  default_layout: {},
  default_style: {},
};

function makeSection(partial: Partial<PageSection> = {}): PageSection {
  return {
    id: "section-1",
    page_id: "page-1",
    section_type: "hero",
    name: "Hero",
    sort_order: 0,
    is_visible: true,
    content: { heading: "Hello draft" },
    layout: {},
    style: {},
    schema_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const PREVIEW: PortfolioPreview = {
  portfolio: {
    id: "portfolio-1",
    name: "Ada's portfolio",
    slug: "ada",
    description: null,
    status: "draft",
    published_at: null,
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
      sections: [makeSection()],
    },
    {
      id: "page-2",
      title: "About",
      slug: "about",
      is_homepage: false,
      is_visible: true,
      sort_order: 1,
      seo_title: null,
      seo_description: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      sections: [
        makeSection({
          id: "section-2",
          page_id: "page-2",
          name: "About section",
          content: { heading: "About me" },
        }),
      ],
    },
  ],
  navigation: [
    {
      id: "nav-1",
      portfolio_id: "portfolio-1",
      location: "header",
      label: "About",
      destination_type: "page",
      page_id: "page-2",
      external_url: null,
      sort_order: 0,
      is_visible: true,
    },
  ],
  theme: { schema_version: 1, tokens: {}, components: {} },
  media: [],
};

describe("DraftPreview", () => {
  it("shows the draft banner and renders the latest draft content", async () => {
    vi.mocked(fetchPortfolioPreview).mockResolvedValue(PREVIEW);
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);

    expect(
      await screen.findByText("Draft preview — not published"),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Hello draft" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada's portfolio")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About me" })).toBeNull();
  });

  it("asks the visitor to sign in when the session is not authenticated", async () => {
    vi.mocked(fetchPortfolioPreview).mockRejectedValue(
      new ApiError("Unauthorized", 401),
    );
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);

    expect(
      await screen.findByText("Sign in to preview your draft."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows load failures with a working retry", async () => {
    vi.mocked(fetchPortfolioPreview)
      .mockRejectedValueOnce(new ApiError("Boom", 500))
      .mockResolvedValue(PREVIEW);
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);

    const retry = await screen.findByRole("button", { name: "Retry" });
    await userEvent.setup().click(retry);

    expect(
      await screen.findByRole("heading", { name: "Hello draft" }),
    ).toBeInTheDocument();
  });

  it("switches the rendered page from the page selector", async () => {
    vi.mocked(fetchPortfolioPreview).mockResolvedValue(PREVIEW);
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);
    await screen.findByRole("heading", { name: "Hello draft" });

    await userEvent.selectOptions(screen.getByLabelText("Page"), "page-2");

    expect(
      await screen.findByRole("heading", { name: "About me" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hello draft" })).toBeNull();
  });

  it("switches pages from header navigation links", async () => {
    vi.mocked(fetchPortfolioPreview).mockResolvedValue(PREVIEW);
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);
    await screen.findByRole("heading", { name: "Hello draft" });

    await userEvent.click(screen.getByRole("button", { name: "About" }));

    expect(
      await screen.findByRole("heading", { name: "About me" }),
    ).toBeInTheDocument();
  });

  it("tracks the selected device mode", async () => {
    vi.mocked(fetchPortfolioPreview).mockResolvedValue(PREVIEW);
    vi.mocked(listSectionTypes).mockResolvedValue([HERO_TYPE]);
    render(<DraftPreview portfolioId="portfolio-1" />);
    await screen.findByRole("heading", { name: "Hello draft" });

    const desktop = screen.getByRole("button", { name: "Desktop" });
    const mobile = screen.getByRole("button", { name: "Mobile" });
    expect(desktop).toHaveAttribute("aria-pressed", "true");
    expect(mobile).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(mobile);
    await waitFor(() => expect(mobile).toHaveAttribute("aria-pressed", "true"));
    expect(desktop).toHaveAttribute("aria-pressed", "false");
  });
});
