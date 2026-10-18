// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { MediaLibrary } from "@/components/builder/media-library";
import { ApiError } from "@/lib/api/client";
import {
  deleteMedia,
  listMedia,
  updateMedia,
  uploadMedia,
} from "@/lib/api/media";
import type { MediaAsset } from "@/types/media";

vi.mock("@/lib/api/media", () => ({
  listMedia: vi.fn(),
  uploadMedia: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
  mediaFileUrl: (id: string) => `http://api.test/media/${id}/file`,
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function makeAsset(partial: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset-1",
    portfolio_id: "portfolio-1",
    storage_key: "portfolio-1/asset-1.png",
    original_filename: "image.png",
    mime_type: "image/png",
    size_bytes: 1536,
    width: 1024,
    height: 768,
    alt_text: "A picture",
    caption: "Nice shot",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("MediaLibrary", () => {
  it("shows a loading state and then the asset metadata", async () => {
    vi.mocked(listMedia).mockResolvedValue([makeAsset()]);
    render(<MediaLibrary portfolioId="portfolio-1" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading media assets",
    );
    expect(await screen.findByText("image.png")).toBeInTheDocument();
    expect(
      screen.getByText(/1024 × 768px · image\/png · 1\.5 KB/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Alt: A picture/)).toBeInTheDocument();
    expect(screen.getByText(/Caption: Nice shot/)).toBeInTheDocument();
    expect(screen.getByText("1 of 1 asset")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is uploaded", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    render(<MediaLibrary portfolioId="portfolio-1" />);
    expect(
      await screen.findByText(
        "No media uploaded yet. Upload an image to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("surfaces a load error and recovers through Retry", async () => {
    vi.mocked(listMedia)
      .mockRejectedValueOnce(new ApiError("Boom", 500))
      .mockResolvedValueOnce([makeAsset()]);
    render(<MediaLibrary portfolioId="portfolio-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("image.png")).toBeInTheDocument();
    expect(listMedia).toHaveBeenCalledTimes(2);
  });

  it("uploads a file, shows progress, and refreshes the list", async () => {
    vi.mocked(listMedia)
      .mockResolvedValueOnce([makeAsset()])
      .mockResolvedValueOnce([
        makeAsset({ id: "asset-2", original_filename: "new.png" }),
        makeAsset(),
      ]);
    vi.mocked(uploadMedia).mockResolvedValue(
      makeAsset({ id: "asset-2", original_filename: "new.png" }),
    );
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByText("image.png");

    const file = new File(["data"], "new.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload image file"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("Uploading…")).toBeInTheDocument();
    expect(await screen.findByText("new.png")).toBeInTheDocument();
    expect(uploadMedia).toHaveBeenCalledWith("portfolio-1", file);
    // The initial load plus the post-upload refresh.
    await waitFor(() => expect(listMedia).toHaveBeenCalledTimes(2));
  });

  it("shows the upload error returned by the API", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    vi.mocked(uploadMedia).mockRejectedValue(
      new ApiError("File exceeds 10 MB.", 422),
    );
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByTestId("media-empty");

    fireEvent.change(screen.getByLabelText("Upload image file"), {
      target: { files: [new File(["x"], "big.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File exceeds 10 MB.",
    );
  });

  it("deletes an asset after confirmation and refreshes", async () => {
    vi.mocked(listMedia)
      .mockResolvedValueOnce([makeAsset()])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteMedia).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByText("image.png");

    await user.click(screen.getByRole("button", { name: "Delete image.png" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(deleteMedia).toHaveBeenCalledWith("asset-1");
    await waitFor(() =>
      expect(screen.queryByText("image.png")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("media-empty")).toBeInTheDocument();
  });

  it("keeps the asset when delete fails", async () => {
    vi.mocked(listMedia).mockResolvedValue([makeAsset()]);
    vi.mocked(deleteMedia).mockRejectedValue(
      new ApiError("Asset is in use.", 409),
    );
    const user = userEvent.setup();
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByText("image.png");

    await user.click(screen.getByRole("button", { name: "Delete image.png" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Asset is in use.",
    );
    expect(screen.getByText("image.png")).toBeInTheDocument();
  });

  it("filters assets by filename through the search box", async () => {
    vi.mocked(listMedia).mockResolvedValue([
      makeAsset(),
      makeAsset({ id: "asset-2", original_filename: "other.jpg" }),
    ]);
    const user = userEvent.setup();
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByText("image.png");

    await user.type(screen.getByLabelText("Search media"), "other");
    expect(screen.queryByText("image.png")).not.toBeInTheDocument();
    expect(screen.getByText("other.jpg")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search media"));
    await user.type(screen.getByLabelText("Search media"), "zzz");
    expect(
      await screen.findByText("No assets match your search."),
    ).toBeInTheDocument();
  });

  it("saves edited alt text and caption metadata", async () => {
    vi.mocked(listMedia)
      .mockResolvedValueOnce([makeAsset()])
      .mockResolvedValueOnce([
        makeAsset({ alt_text: "Updated alt", caption: "Nice shot" }),
      ]);
    vi.mocked(updateMedia).mockResolvedValue(
      makeAsset({ alt_text: "Updated alt", caption: "Nice shot" }),
    );
    const user = userEvent.setup();
    render(<MediaLibrary portfolioId="portfolio-1" />);
    await screen.findByText("image.png");

    await user.click(screen.getByRole("button", { name: "Edit metadata" }));
    const alt = screen.getByLabelText("Alt text");
    await user.clear(alt);
    await user.type(alt, "Updated alt");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateMedia).toHaveBeenCalledWith("asset-1", {
      alt_text: "Updated alt",
      caption: "Nice shot",
    });
    expect(await screen.findByText(/Alt: Updated alt/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Alt text")).not.toBeInTheDocument();
  });
});
