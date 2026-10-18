import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemePreview } from "@/components/design/theme-preview";
import type { ThemeValues } from "@/types/theme";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Fail the test if React logs a duplicate-key or prop warning while rendering. */
function renderQuietly(node: ReactElement): string {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const html = renderToStaticMarkup(node);
  expect(error).not.toHaveBeenCalled();
  return html;
}

describe("ThemePreview", () => {
  it("renders the registry defaults without any tokens", () => {
    const html = renderQuietly(<ThemePreview tokens={{}} components={{}} />);
    expect(html).toContain('aria-label="Theme preview"');
    expect(html).toContain("Design that speaks");
    // Default registry chrome is visible.
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).not.toContain("<aside");
  });

  it("reflects the provided color, typography, and card tokens", () => {
    const tokens: ThemeValues = {
      colors: {
        page_background: "#000000",
        text: "#ffffff",
        primary: "#111111",
        button_background: "#444444",
        button_text: "#eeeeee",
        link: "#555555",
        link_hover: "#666666",
        sidebar_background: "#777777",
        sidebar_text: "#888888",
      },
      typography: { base_size: "large", heading_scale: "large" },
      cards: { radius: "pill", padding: "large" },
      borders: { radius: "small", shadow: "medium" },
    };
    const html = renderQuietly(
      <ThemePreview tokens={tokens} components={{}} />,
    );

    expect(html).toContain("background:#000000");
    expect(html).toContain("background:#444444");
    expect(html).toContain("color:#eeeeee");
    // Link colours are exposed as CSS variables for the hover state.
    expect(html).toContain("--pb-link:#555555");
    expect(html).toContain("--pb-link-hover:#666666");
    expect(html).toContain("font-size:18px");
  });

  it("demonstrates the link decoration tokens on the preview link", () => {
    const tokens: ThemeValues = {
      links: { underline: "always", style: "bold" },
    };
    const html = renderQuietly(
      <ThemePreview tokens={tokens} components={{}} />,
    );
    const linkIndex = html.indexOf("View project");
    const linkTag = html.slice(html.lastIndexOf("<a", linkIndex), linkIndex);
    expect(linkTag).toContain("pb-preview-link");
    expect(linkTag).toContain("underline");
    expect(linkTag).toContain("font-bold");
  });

  it("renders the saved global layout chrome", () => {
    const html = renderQuietly(
      <ThemePreview
        tokens={{}}
        components={{
          header: {
            layout: "center",
            show_navigation: false,
            cta_label: "Hire me",
          },
          footer: { layout: "columns", copyright: "© 2026 Ada" },
          sidebar: { visible: true, position: "right", width: "wide" },
          branding: { logo_text: "Ada", tagline: "Engineer" },
          social: {
            links: [{ platform: "github", url: "https://github.com/ada" }],
          },
        }}
      />,
    );
    expect(html).toContain("Hire me");
    expect(html).toContain("© 2026 Ada");
    expect(html).toContain("Ada");
    expect(html).toContain("Engineer");
    expect(html).toContain("github");
    expect(html).toContain("<aside");
    expect(html).toContain("width:280px");
  });

  it("hides chrome that the saved layout disables", () => {
    const html = renderQuietly(
      <ThemePreview
        tokens={{}}
        components={{ header: { visible: false }, footer: { visible: false } }}
      />,
    );
    expect(html).not.toContain("<header");
    expect(html).not.toContain("<footer");
  });
});
