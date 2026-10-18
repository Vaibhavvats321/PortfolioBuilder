import { describe, expect, it } from "vitest";

import {
  buildPreviewChrome,
  buildPreviewTheme,
  sectionStyleToCss,
  sectionTextStyle,
} from "@/lib/theme/style";

describe("sectionStyleToCss", () => {
  it("returns no overrides for inherit values", () => {
    expect(
      sectionStyleToCss({
        background: "inherit",
        text_color: "",
        spacing: "inherit",
        width: "inherit",
        radius: "inherit",
        shadow: "inherit",
        border: "inherit",
      }),
    ).toEqual({});
  });

  it("returns no overrides when style is undefined", () => {
    expect(sectionStyleToCss(undefined)).toEqual({});
  });

  it("maps a custom background color", () => {
    expect(
      sectionStyleToCss({ background: "custom", background_color: "#101010" }),
    ).toEqual({
      background: "#101010",
    });
  });

  it("maps spacing, width, radius, shadow, and border", () => {
    const css = sectionStyleToCss({
      background: "transparent",
      text_color: "#222222",
      spacing: "large",
      width: "narrow",
      radius: "pill",
      shadow: "medium",
      border: "thin",
    });
    expect(css.background).toBe("transparent");
    expect(css.color).toBe("#222222");
    expect(css.paddingTop).toBe("40px");
    expect(css.paddingBottom).toBe("40px");
    expect(css.maxWidth).toBe("640px");
    expect(css.borderRadius).toBe("9999px");
    expect(css.boxShadow).toContain("rgba");
    expect(css.border).toContain("1px solid");
  });
});

describe("buildPreviewTheme", () => {
  it("falls back to safe defaults when tokens are missing", () => {
    const theme = buildPreviewTheme(undefined);
    expect(theme.pageBackground).toBe("#ffffff");
    expect(theme.text).toBe("#0f172a");
    expect(theme.baseSize).toBe("16px");
    expect(theme.contentWidth).toBe("768px");
    expect(theme.textAlign).toBe("left");
    expect(theme.headingFont).toContain("system");
  });

  it("derives values from provided tokens", () => {
    const theme = buildPreviewTheme({
      colors: {
        page_background: "#000000",
        text: "#ffffff",
        primary: "#111111",
        secondary: "#222222",
        accent: "#333333",
        button_background: "#444444",
        button_text: "#eeeeee",
        link: "#555555",
        link_hover: "#666666",
        sidebar_background: "#777777",
        sidebar_text: "#888888",
        border: "#999999",
      },
      typography: {
        base_size: "large",
        heading_scale: "large",
        font_weight: "bold",
        line_height: "relaxed",
        text_align: "center",
        text_transform: "uppercase",
        heading_font: "serif",
      },
      spacing: {
        content_width: "wide",
        section_spacing: "spacious",
        container_padding: "large",
        grid_gap: "large",
      },
      cards: {
        background: "transparent",
        border: "thick",
        radius: "pill",
        shadow: "large",
        padding: "large",
      },
      borders: { border_width: "thick", radius: "small", shadow: "medium" },
      buttons: { shape: "square", size: "large" },
      links: { underline: "always", style: "bold" },
    });
    expect(theme.pageBackground).toBe("#000000");
    expect(theme.text).toBe("#ffffff");
    expect(theme.baseSize).toBe("18px");
    expect(theme.headingSize).toBe("40px");
    expect(theme.headingWeight).toBe(700);
    expect(theme.bodyWeight).toBe(700);
    expect(theme.lineHeight).toBe(1.75);
    expect(theme.textAlign).toBe("center");
    expect(theme.textTransform).toBe("uppercase");
    expect(theme.headingFont).toContain("Georgia");
    expect(theme.contentWidth).toBe("1024px");
    expect(theme.sectionPadding).toBe("80px");
    expect(theme.containerPadding).toBe("32px");
    expect(theme.gridGap).toBe("20px");

    // Cards group drives the card surface, borders group the global tiles.
    expect(theme.cardBackground).toBe("transparent");
    expect(theme.cardBorder).toBe("2px solid #999999");
    expect(theme.cardRadius).toBe("9999px");
    expect(theme.cardShadow).toBe("0 16px 40px rgba(15, 23, 42, 0.18)");
    expect(theme.cardPadding).toBe("24px");
    expect(theme.globalBorder).toBe("2px solid #999999");
    expect(theme.globalRadius).toBe("4px");
    expect(theme.globalShadow).toBe("0 6px 16px rgba(15, 23, 42, 0.12)");

    // Selected colors that the preview uses directly.
    expect(theme.secondary).toBe("#222222");
    expect(theme.accent).toBe("#333333");
    expect(theme.buttonBackground).toBe("#444444");
    expect(theme.buttonText).toBe("#eeeeee");
    expect(theme.link).toBe("#555555");
    expect(theme.linkHover).toBe("#666666");
    expect(theme.linkUnderline).toBe("always");
    expect(theme.linkStyle).toBe("bold");
    expect(theme.sidebarBackground).toBe("#777777");
    expect(theme.sidebarText).toBe("#888888");

    expect(theme.buttonRadius).toBe("0px");
    expect(theme.buttonPadding).toBe("14px 28px");
  });

  it("defaults card and global styling from the registry defaults", () => {
    const theme = buildPreviewTheme(undefined);
    expect(theme.cardBackground).toBe("#f8fafc");
    expect(theme.cardRadius).toBe("8px");
    expect(theme.globalRadius).toBe("8px");
    expect(theme.globalBorder).toBe("1px solid #e2e8f0");
    expect(theme.globalShadow).toBe("0 1px 3px rgba(15, 23, 42, 0.1)");
  });

  it("turns a subtle or brand gradient into a page background image", () => {
    const none = buildPreviewTheme({
      colors: { page_background: "#ffffff", surface: "#f8fafc" },
    });
    expect(none.pageBackground).toBe("#ffffff");

    const subtle = buildPreviewTheme({
      colors: { page_background: "#ffffff", surface: "#f8fafc" },
      background: { gradient: "subtle" },
    });
    expect(subtle.pageBackground).toContain("linear-gradient");
    expect(subtle.pageBackground).toContain("#f8fafc");

    const brand = buildPreviewTheme({
      colors: { page_background: "#ffffff", primary: "#112233" },
      background: { gradient: "brand" },
    });
    expect(brand.pageBackground).toContain("linear-gradient");
    expect(brand.pageBackground).toContain("#11223333");
  });
});

describe("sectionTextStyle", () => {
  it("returns no override when there is no text color", () => {
    expect(sectionTextStyle(undefined)).toBeUndefined();
    expect(sectionTextStyle({ text_color: "" })).toBeUndefined();
  });

  it("returns the stored text color override", () => {
    expect(sectionTextStyle({ text_color: "#abcdef" })).toEqual({
      color: "#abcdef",
    });
  });
});

describe("buildPreviewChrome", () => {
  it("falls back to the registry defaults", () => {
    const chrome = buildPreviewChrome(undefined);
    expect(chrome.headerVisible).toBe(true);
    expect(chrome.headerLayout).toBe("left");
    expect(chrome.showLogo).toBe(true);
    expect(chrome.showNavigation).toBe(true);
    expect(chrome.footerVisible).toBe(true);
    expect(chrome.footerLayout).toBe("simple");
    expect(chrome.showSocial).toBe(true);
    expect(chrome.sidebarVisible).toBe(false);
    expect(chrome.sidebarPosition).toBe("left");
    expect(chrome.sidebarWidth).toBe("208px");
    expect(chrome.logoText).toBe("Your Name");
    expect(chrome.socialLinks).toEqual([]);
  });

  it("reads saved header, sidebar, branding, and social options", () => {
    const chrome = buildPreviewChrome({
      header: {
        visible: false,
        layout: "split",
        show_navigation: false,
        cta_label: "Hire me",
      },
      footer: { layout: "columns", copyright: "© 2026" },
      sidebar: { visible: true, position: "right", width: "wide" },
      branding: {
        logo_text: "Ada",
        logo_image_url: "https://x/y.png",
        tagline: "Dev",
      },
      social: {
        links: [
          { platform: "github", url: "https://github.com/ada" },
          { platform: "website", url: "" },
          "not-an-object",
        ],
      },
    });
    expect(chrome.headerVisible).toBe(false);
    expect(chrome.headerLayout).toBe("split");
    expect(chrome.showNavigation).toBe(false);
    expect(chrome.ctaLabel).toBe("Hire me");
    expect(chrome.footerLayout).toBe("columns");
    expect(chrome.copyright).toBe("© 2026");
    expect(chrome.sidebarVisible).toBe(true);
    expect(chrome.sidebarPosition).toBe("right");
    expect(chrome.sidebarWidth).toBe("280px");
    expect(chrome.logoText).toBe("Ada");
    expect(chrome.logoImageUrl).toBe("https://x/y.png");
    expect(chrome.tagline).toBe("Dev");
    // Links without a URL are dropped from the preview.
    expect(chrome.socialLinks).toEqual([
      { platform: "github", url: "https://github.com/ada" },
    ]);
  });
});
