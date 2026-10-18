// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { EditorToolbar } from "@/components/builder/editor-toolbar";
import type { ToolbarPublication } from "@/components/builder/editor-toolbar";

afterEach(() => {
  cleanup();
});

function renderToolbar(
  overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {},
) {
  const onSaveDraft = overrides.onSaveDraft ?? vi.fn();
  render(
    <EditorToolbar
      portfolioId="portfolio-1"
      saveStatus="idle"
      dirty={false}
      hasErrors={false}
      {...overrides}
      onSaveDraft={onSaveDraft}
    />,
  );
  return { onSaveDraft };
}

describe("EditorToolbar", () => {
  it("shows the idle state with Save Draft disabled", () => {
    renderToolbar();

    expect(screen.getByRole("status")).toHaveTextContent("No changes yet");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled();
  });

  it("shows saved, saving, and error states", () => {
    const { rerender } = render(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="saved"
        dirty={false}
        hasErrors={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved");

    rerender(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="saving"
        dirty
        hasErrors={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled();

    rerender(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="error"
        dirty
        hasErrors={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Save failed");
  });

  it("enables Save Draft for unsaved changes and flushes them", async () => {
    const user = userEvent.setup();
    const { onSaveDraft } = renderToolbar({ dirty: true });

    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("blocks Save Draft while the form has validation errors", () => {
    renderToolbar({ dirty: true, hasErrors: true });

    expect(screen.getByRole("status")).toHaveTextContent(
      "fix validation errors",
    );
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled();
  });

  it("links to the protected draft preview route", () => {
    renderToolbar();

    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute(
      "href",
      "/dashboard/portfolios/portfolio-1/preview",
    );
  });
});

describe("EditorToolbar publication", () => {
  function renderWithPublication(
    publication: Partial<ToolbarPublication> = {},
    onPublish = vi.fn(),
    toolbar: Partial<Parameters<typeof EditorToolbar>[0]> = {},
  ) {
    render(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="idle"
        dirty={false}
        hasErrors={false}
        {...toolbar}
        onSaveDraft={toolbar.onSaveDraft ?? vi.fn()}
        publication={{
          status: "draft",
          publishing: false,
          error: null,
          result: null,
          ...publication,
        }}
        onPublish={onPublish}
      />,
    );
    return { onPublish };
  }

  it("publishes a draft portfolio", async () => {
    const user = userEvent.setup();
    const { onPublish } = renderWithPublication({ status: "draft" });

    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("offers republishing for a published portfolio", () => {
    renderWithPublication({ status: "published" });

    expect(
      screen.getByRole("button", { name: "Publish changes" }),
    ).toBeEnabled();
  });

  it("disables publishing while in flight, saving, or holding unsaved edits", () => {
    const { rerender } = render(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="idle"
        dirty={false}
        hasErrors={false}
        onSaveDraft={vi.fn()}
        publication={{
          status: "draft",
          publishing: true,
          error: null,
          result: null,
        }}
        onPublish={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();

    rerender(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="saving"
        dirty={false}
        hasErrors={false}
        onSaveDraft={vi.fn()}
        publication={{
          status: "draft",
          publishing: false,
          error: null,
          result: null,
        }}
        onPublish={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();

    rerender(
      <EditorToolbar
        portfolioId="portfolio-1"
        saveStatus="idle"
        dirty
        hasErrors={false}
        onSaveDraft={vi.fn()}
        publication={{
          status: "draft",
          publishing: false,
          error: null,
          result: null,
        }}
        onPublish={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("surfaces publication errors from the backend", () => {
    renderWithPublication({
      error: 'Page "Home" section "Hero": content.heading is required.',
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "content.heading is required.",
    );
  });

  it("reveals the public URL only after a successful publish", () => {
    renderWithPublication({
      status: "published",
      result: { version: 7, publicPath: "/p/my-portfolio" },
    });

    expect(screen.getByText(/Version 7 is live at/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "/p/my-portfolio" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/p/my-portfolio"),
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});
