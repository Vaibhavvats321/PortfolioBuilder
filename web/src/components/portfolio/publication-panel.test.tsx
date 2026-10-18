// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { PublicationPanel } from "@/components/portfolio/publication-panel";
import { ApiError } from "@/lib/api/client";
import { fetchPortfolio } from "@/lib/api/portfolios";
import { publishPortfolio, unpublishPortfolio } from "@/lib/api/publication";
import type { Portfolio } from "@/types/portfolio";

vi.mock("@/lib/api/publication", () => ({
  fetchPortfolioPreview: vi.fn(),
  publishPortfolio: vi.fn(),
  unpublishPortfolio: vi.fn(),
}));

vi.mock("@/lib/api/portfolios", () => ({
  listPortfolios: vi.fn(),
  createPortfolio: vi.fn(),
  fetchPortfolio: vi.fn(),
  updatePortfolio: vi.fn(),
  deletePortfolio: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function makePortfolio(partial: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "portfolio-1",
    owner_id: "user-1",
    name: "My portfolio",
    slug: "my-portfolio",
    description: null,
    status: "draft",
    settings_json: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    published_at: null,
    current_published_version_id: null,
    ...partial,
  };
}

const PUBLISHED_AT = "2026-02-01T12:00:00Z";

describe("PublicationPanel", () => {
  it("shows the draft state without any public URL", () => {
    render(
      <PublicationPanel portfolio={makePortfolio()} onChanged={vi.fn()} />,
    );

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: /\/p\// })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
  });

  it("reveals the public URL only after a successful publish", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(publishPortfolio).mockResolvedValue({
      status: "published",
      published_at: PUBLISHED_AT,
      version_number: 3,
      public_path: "/p/my-portfolio",
    });
    vi.mocked(fetchPortfolio).mockResolvedValue(
      makePortfolio({ status: "published", published_at: PUBLISHED_AT }),
    );
    const { rerender } = render(
      <PublicationPanel portfolio={makePortfolio()} onChanged={onChanged} />,
    );

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(publishPortfolio).toHaveBeenCalledWith("portfolio-1"),
    );
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Published version 3.",
    );
    // No URL until the parent refreshes the portfolio with the new status.
    expect(screen.queryByRole("link", { name: /\/p\// })).toBeNull();

    rerender(
      <PublicationPanel
        portfolio={makePortfolio({
          status: "published",
          published_at: PUBLISHED_AT,
        })}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /\/p\/my-portfolio/ });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/p/my-portfolio"),
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
  });

  it("surfaces validation errors and leaves the portfolio unpublished", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(publishPortfolio).mockRejectedValue(
      new ApiError(
        'Page "Home" section "Hero": content.heading is required.',
        422,
      ),
    );
    render(
      <PublicationPanel portfolio={makePortfolio()} onChanged={onChanged} />,
    );

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "content.heading is required.",
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\/p\// })).toBeNull();
  });

  it("requires confirmation before unpublishing and drops the URL after", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(unpublishPortfolio).mockResolvedValue(makePortfolio());
    const { rerender } = render(
      <PublicationPanel
        portfolio={makePortfolio({
          status: "published",
          published_at: PUBLISHED_AT,
        })}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(screen.getByText(/public pages immediately/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, unpublish" }));
    await waitFor(() =>
      expect(unpublishPortfolio).toHaveBeenCalledWith("portfolio-1"),
    );
    expect(onChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Unpublished.");

    rerender(
      <PublicationPanel portfolio={makePortfolio()} onChanged={onChanged} />,
    );
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\/p\// })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
  });

  it("shows unpublish failures without changing the published state", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(unpublishPortfolio).mockRejectedValue(
      new ApiError("Session expired.", 401),
    );
    render(
      <PublicationPanel
        portfolio={makePortfolio({
          status: "published",
          published_at: PUBLISHED_AT,
        })}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    await user.click(screen.getByRole("button", { name: "Yes, unpublish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session expired.",
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
