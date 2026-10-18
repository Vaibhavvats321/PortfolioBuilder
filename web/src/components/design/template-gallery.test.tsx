import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TemplateGallery,
  templateSwatches,
} from "@/components/design/template-gallery";
import type { Template } from "@/types/theme";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTemplate(partial: Partial<Template> = {}): Template {
  return {
    id: "template-1",
    name: "Template",
    description: "A starter design",
    tokens: {},
    components: {},
    ...partial,
  };
}

describe("templateSwatches", () => {
  it("reads the palette tokens in a stable order", () => {
    const swatches = templateSwatches(
      makeTemplate({
        tokens: {
          colors: {
            primary: "#111111",
            secondary: "#222222",
            accent: "#333333",
            page_background: "#444444",
          },
        },
      }),
    );
    expect(swatches.map((swatch) => swatch.token)).toEqual([
      "primary",
      "secondary",
      "accent",
      "page_background",
    ]);
    expect(swatches.map((swatch) => swatch.color)).toEqual([
      "#111111",
      "#222222",
      "#333333",
      "#444444",
    ]);
  });

  it("drops missing colors but keeps token keys unique", () => {
    const swatches = templateSwatches(
      makeTemplate({ tokens: { colors: { primary: "#111111" } } }),
    );
    expect(swatches).toEqual([{ token: "primary", color: "#111111" }]);
  });
});

describe("TemplateGallery", () => {
  it("renders duplicate colors without React key warnings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Two tokens sharing one color would previously collide on key={color}.
    const html = renderToStaticMarkup(
      <TemplateGallery
        templates={[
          makeTemplate({
            tokens: {
              colors: {
                primary: "#111111",
                secondary: "#111111",
                accent: "#111111",
                page_background: "#111111",
              },
            },
          }),
        ]}
        applyingId={null}
        onApply={() => {}}
      />,
    );
    expect(error).not.toHaveBeenCalled();
    expect(html.match(/background:#111111/g)).toHaveLength(4);
  });

  it("shows an empty state when there are no templates", () => {
    expect(
      renderToStaticMarkup(
        <TemplateGallery templates={[]} applyingId={null} onApply={() => {}} />,
      ),
    ).toContain("No templates are available.");
  });
});
