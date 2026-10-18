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

import {
  MediaPicker,
  MediaPickerButton,
} from "@/components/builder/media-picker";
import { ApiError } from "@/lib/api/client";
import { listMedia, uploadMedia } from "@/lib/api/media";
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
    caption: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("MediaPicker", () => {
  it("loads the portfolio library and selects an asset", async () => {
    vi.mocked(listMedia).mockResolvedValue([makeAsset()]);
    const onSelect = vi.fn();
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );
    expect(listMedia).toHaveBeenCalledWith("portfolio-1");
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: "Select image.png" }));
    expect(onSelect).toHaveBeenCalledWith(makeAsset());
  });

  it("shows the loading and empty states", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading media assets",
    );
    expect(
      await screen.findByText(
        "No media uploaded yet. Upload an image to get started.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a load error and recovers through Retry", async () => {
    vi.mocked(listMedia)
      .mockRejectedValueOnce(new ApiError("Library unavailable", 500))
      .mockResolvedValueOnce([makeAsset()]);
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Library unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("image.png")).toBeInTheDocument();
  });

  it("closes on Escape, backdrop click, and the Close button", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("media-picker-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("uploads from within the dialog and selects the new asset", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    vi.mocked(uploadMedia).mockResolvedValue(
      makeAsset({ id: "asset-9", original_filename: "fresh.png" }),
    );
    const onSelect = vi.fn();
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );
    await screen.findByRole("dialog");

    const file = new File(["x"], "fresh.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload image file"), {
      target: { files: [file] },
    });
    expect(uploadMedia).toHaveBeenCalledWith("portfolio-1", file);
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "asset-9" }),
      ),
    );
  });

  it("shows upload errors inside the dialog", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    vi.mocked(uploadMedia).mockRejectedValue(
      new ApiError("File exceeds 10 MB.", 422),
    );
    render(
      <MediaPicker
        portfolioId="portfolio-1"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    await screen.findByRole("dialog");

    fireEvent.change(screen.getByLabelText("Upload image file"), {
      target: { files: [new File(["x"], "big.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File exceeds 10 MB.",
    );
  });
});

describe("MediaPickerButton", () => {
  it("opens the dialog and restores focus to the trigger on close", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MediaPickerButton portfolioId="portfolio-1" onSelect={onSelect} />);

    const trigger = screen.getByRole("button", { name: "Browse media…" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
