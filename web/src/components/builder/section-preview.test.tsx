import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionPreview } from "@/components/builder/section-preview";
import type { PageSection } from "@/types/section";

function makeSection(partial: Partial<PageSection>): PageSection {
  return {
    id: "section-1",
    page_id: "page-1",
    section_type: "hero",
    name: "Hero",
    sort_order: 0,
    is_visible: true,
    content: {},
    layout: {},
    style: {},
    schema_version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function render(section: PageSection): string {
  return renderToStaticMarkup(<SectionPreview section={section} />);
}

describe("SectionPreview style overrides", () => {
  it("applies the section text color to headings and paragraphs", () => {
    const html = render(
      makeSection({
        section_type: "hero",
        content: { heading: "Hello", subheading: "Sub", body: "Body copy" },
        style: { text_color: "#ff0000" },
      }),
    );
    // The preview card plus the heading, subheading, and body each carry it.
    expect(html.match(/color:#ff0000/g)).toHaveLength(4);
  });

  it("does not recolor the hero availability badge", () => {
    const html = render(
      makeSection({
        section_type: "hero",
        content: {
          heading: "Hello",
          show_availability: true,
          availability_text: "Open to work",
        },
        style: { text_color: "#ff0000" },
      }),
    );
    const badgeIndex = html.indexOf("Open to work");
    const badgeTag = html.slice(
      html.lastIndexOf("<span", badgeIndex),
      badgeIndex,
    );
    // The badge keeps its own high-contrast styling.
    expect(badgeTag).toContain("bg-slate-900");
    expect(badgeTag).not.toContain("color:#ff0000");
  });

  it("adds no inline text color when the override is unset", () => {
    const html = render(
      makeSection({ section_type: "rich_text", content: { heading: "Hi" } }),
    );
    expect(html).not.toContain('style="color:');
  });

  it("applies the section background to the preview card", () => {
    const html = render(
      makeSection({
        section_type: "rich_text",
        style: { background: "custom", background_color: "#101010" },
      }),
    );
    expect(html).toContain("background:#101010");
  });
});

describe("SectionPreview content", () => {
  it("counts the stored items for list-style sections", () => {
    const html = render(
      makeSection({
        section_type: "project_grid",
        content: { projects: [{}, {}] },
      }),
    );
    expect(html).toContain("2 project(s)");
  });

  it("reports unsupported section types", () => {
    const html = render(
      makeSection({ section_type: "mystery", name: "Mystery" }),
    );
    expect(html).toContain("Unsupported section type: mystery");
  });

  it("renders the stored image URL for image sections", () => {
    const html = render(
      makeSection({
        section_type: "image_text",
        content: {
          heading: "Shot",
          image_url: "http://api.test/media/asset-1/file",
          image_alt: "A screenshot",
        },
      }),
    );
    expect(html).toContain('src="http://api.test/media/asset-1/file"');
    expect(html).toContain('alt="A screenshot"');
  });
});

describe("SectionPreview responsive breakpoints", () => {
  function renderAt(
    section: PageSection,
    breakpoint: "desktop" | "tablet" | "mobile",
  ): string {
    return renderToStaticMarkup(
      <SectionPreview section={section} breakpoint={breakpoint} />,
    );
  }

  it("constrains the preview frame per breakpoint", () => {
    const section = makeSection({});
    expect(renderAt(section, "desktop")).toContain('data-breakpoint="desktop"');
    expect(renderAt(section, "desktop")).toContain("max-width:100%");
    expect(renderAt(section, "tablet")).toContain("max-width:768px");
    expect(renderAt(section, "mobile")).toContain("max-width:375px");
  });

  it("defaults to desktop when no breakpoint is given", () => {
    expect(render(makeSection({}))).toContain('data-breakpoint="desktop"');
  });

  it("applies the override for the active breakpoint only", () => {
    const section = makeSection({
      section_type: "rich_text",
      content: { heading: "Hi" },
      style: {
        spacing: "medium",
        responsive_override: {
          desktop: null,
          tablet: null,
          mobile: { spacing: "large" },
        },
      },
    });
    const mobile = renderAt(section, "mobile");
    const tablet = renderAt(section, "tablet");
    // medium = 24px, large = 40px.
    expect(mobile).toContain("padding-top:40px");
    expect(mobile).toContain("padding-bottom:40px");
    expect(tablet).toContain("padding-top:24px");
    expect(tablet).not.toContain("padding-top:40px");
  });

  it("does not mutate the stored section or its overrides", () => {
    const section = makeSection({
      style: {
        spacing: "medium",
        responsive_override: { mobile: { spacing: "large" } },
      },
    });
    const before = JSON.stringify(section);
    renderAt(section, "desktop");
    renderAt(section, "mobile");
    expect(JSON.stringify(section)).toBe(before);
  });
});
