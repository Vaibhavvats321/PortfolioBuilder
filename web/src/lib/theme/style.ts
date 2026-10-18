import type { CSSProperties } from "react";

import { fontStack } from "@/lib/theme/fonts";
import { themeFlag, themeValue } from "@/lib/theme/values";
import type { SectionStyle } from "@/types/section";
import type { ThemeValues } from "@/types/theme";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pick(map: Record<string, string>, key: string): string | undefined {
  return map[key];
}

const SPACING: Record<string, string> = {
  none: "0px",
  small: "12px",
  medium: "24px",
  large: "40px",
  xlarge: "64px",
};

const RADIUS: Record<string, string> = {
  none: "0px",
  small: "4px",
  medium: "8px",
  large: "16px",
  pill: "9999px",
};

const SHADOW: Record<string, string> = {
  none: "none",
  small: "0 1px 3px rgba(15, 23, 42, 0.1)",
  medium: "0 6px 16px rgba(15, 23, 42, 0.12)",
  large: "0 16px 40px rgba(15, 23, 42, 0.18)",
};

/** Registry default elevation, used when a shadow token is missing. */
const DEFAULT_SHADOW = SHADOW.small ?? "none";

const WIDTH: Record<string, string> = {
  narrow: "640px",
  default: "768px",
  wide: "1024px",
  full: "100%",
};

const BORDER: Record<string, string> = {
  none: "none",
  thin: "1px solid #e2e8f0",
  thick: "2px solid #e2e8f0",
};

/**
 * Translate a section's stored style overrides into inline CSS for the editor
 * preview. `"inherit"` values produce no override, so the section keeps the
 * default preview styling (which mirrors the global theme).
 */
export function sectionStyleToCss(
  style: SectionStyle | undefined,
): CSSProperties {
  const css: CSSProperties = {};
  if (!style) {
    return css;
  }

  const background = asString(style.background);
  if (background === "custom") {
    const color = asString(style.background_color);
    if (color) {
      css.background = color;
    }
  } else if (background === "surface") {
    css.background = "#f1f5f9";
  } else if (background === "page" || background === "transparent") {
    css.background = "transparent";
  }

  const textColor = asString(style.text_color);
  if (textColor) {
    css.color = textColor;
  }

  const spacing = pick(SPACING, asString(style.spacing));
  if (spacing) {
    css.paddingTop = spacing;
    css.paddingBottom = spacing;
  }

  const width = pick(WIDTH, asString(style.width));
  if (width) {
    css.maxWidth = width;
    css.width = "100%";
    css.marginLeft = "auto";
    css.marginRight = "auto";
  }

  const radius = pick(RADIUS, asString(style.radius));
  if (radius) {
    css.borderRadius = radius;
  }

  const shadow = pick(SHADOW, asString(style.shadow));
  if (shadow) {
    css.boxShadow = shadow;
  }

  const border = pick(BORDER, asString(style.border));
  if (border) {
    css.border = border;
  }

  return css;
}

/**
 * Inline colour for the individual text elements inside a section preview.
 *
 * The preview card also sets `color` on its container, but headings and
 * paragraphs carry their own preview colours, so the override has to be
 * applied directly to those elements to be visible. Elements that pair a
 * background with a contrasting text colour (such as the hero availability
 * badge) must not use this helper, otherwise the override would destroy
 * their contrast.
 */
export function sectionTextStyle(
  style: SectionStyle | undefined,
): CSSProperties | undefined {
  const color = asString(style?.text_color);
  return color ? { color } : undefined;
}

export interface PreviewTheme {
  pageBackground: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  buttonText: string;
  buttonBackground: string;
  link: string;
  linkHover: string;
  linkUnderline: "always" | "hover" | "never";
  linkStyle: "plain" | "bold";
  headerBackground: string;
  headerText: string;
  footerBackground: string;
  footerText: string;
  sidebarBackground: string;
  sidebarText: string;
  headingFont: string;
  bodyFont: string;
  baseSize: string;
  headingSize: string;
  headingWeight: number;
  bodyWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textAlign: "left" | "center";
  textTransform: "none" | "uppercase" | "capitalize";
  contentWidth: string;
  sectionPadding: string;
  containerPadding: string;
  gridGap: string;
  cardBackground: string;
  cardBorder: string;
  cardRadius: string;
  cardShadow: string;
  cardPadding: string;
  globalBorder: string;
  globalRadius: string;
  globalShadow: string;
  buttonRadius: string;
  buttonPadding: string;
}

const BASE_SIZE: Record<string, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

const HEADING_SIZE: Record<string, string> = {
  compact: "24px",
  normal: "32px",
  large: "40px",
};

const HEADING_WEIGHT: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const LINE_HEIGHT: Record<string, number> = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

const LETTER_SPACING: Record<string, string> = {
  tight: "-0.01em",
  normal: "0",
  wide: "0.05em",
};

const CONTENT_WIDTH: Record<string, string> = {
  narrow: "640px",
  default: "768px",
  wide: "1024px",
  full: "100%",
};

const SECTION_PADDING: Record<string, string> = {
  compact: "24px",
  normal: "48px",
  spacious: "80px",
};

const CONTAINER_PADDING: Record<string, string> = {
  none: "0px",
  small: "8px",
  medium: "16px",
  large: "32px",
};

const GRID_GAP: Record<string, string> = {
  none: "0px",
  small: "8px",
  medium: "12px",
  large: "20px",
};

const CARD_PADDING: Record<string, string> = {
  none: "0px",
  small: "8px",
  medium: "16px",
  large: "24px",
};

const BORDER_WIDTH: Record<string, string> = {
  none: "0px",
  thin: "1px",
  thick: "2px",
};

const SIDEBAR_WIDTH: Record<string, string> = {
  narrow: "160px",
  default: "208px",
  wide: "280px",
};

const BUTTON_RADIUS: Record<string, string> = {
  square: "0px",
  rounded: "8px",
  pill: "9999px",
};

const BUTTON_PADDING: Record<string, string> = {
  small: "6px 12px",
  medium: "10px 20px",
  large: "14px 28px",
};

/** Append a two-digit alpha channel, expanding `#rgb` to `#rrggbb` first. */
function withAlpha(color: string, alpha: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const expanded = color
      .slice(1)
      .split("")
      .map((digit) => digit + digit)
      .join("");
    return `#${expanded}${alpha}`;
  }
  return `${color}${alpha}`;
}

/**
 * Build the concrete visual values the preview component renders. Every token
 * the Design Studio exposes is mapped here so the preview demonstrates each
 * control instead of silently ignoring it.
 */
export function buildPreviewTheme(
  tokens: ThemeValues | undefined,
): PreviewTheme {
  const align = themeValue(tokens, "typography", "text_align");
  const transform = themeValue(tokens, "typography", "text_transform");
  const fontWeight = themeValue(tokens, "typography", "font_weight");
  const pageColor =
    themeValue(tokens, "colors", "page_background") || "#ffffff";
  const surface = themeValue(tokens, "colors", "surface") || "#f8fafc";
  const primary = themeValue(tokens, "colors", "primary") || "#4f46e5";
  const border = themeValue(tokens, "colors", "border") || "#e2e8f0";
  const gradient = themeValue(tokens, "background", "gradient");
  const underline = themeValue(tokens, "links", "underline");
  const cardPreset = themeValue(tokens, "cards", "border");
  const cardBackground = themeValue(tokens, "cards", "background");
  const globalWidth =
    BORDER_WIDTH[themeValue(tokens, "borders", "border_width")] ?? "1px";
  return {
    pageBackground:
      gradient === "subtle"
        ? `linear-gradient(180deg, ${surface} 0%, ${pageColor} 100%)`
        : gradient === "brand"
          ? `linear-gradient(180deg, ${withAlpha(primary, "33")} 0%, ${pageColor} 100%)`
          : pageColor,
    surface,
    text: themeValue(tokens, "colors", "text") || "#0f172a",
    mutedText: themeValue(tokens, "colors", "muted_text") || "#64748b",
    border,
    primary,
    secondary: themeValue(tokens, "colors", "secondary") || "#0ea5e9",
    accent: themeValue(tokens, "colors", "accent") || "#f59e0b",
    buttonText: themeValue(tokens, "colors", "button_text") || "#ffffff",
    buttonBackground:
      themeValue(tokens, "colors", "button_background") || "#4f46e5",
    link: themeValue(tokens, "colors", "link") || "#4f46e5",
    linkHover: themeValue(tokens, "colors", "link_hover") || "#4338ca",
    linkUnderline:
      underline === "always" || underline === "never" ? underline : "hover",
    linkStyle:
      themeValue(tokens, "links", "style") === "bold" ? "bold" : "plain",
    headerBackground:
      themeValue(tokens, "colors", "header_background") || "#ffffff",
    headerText: themeValue(tokens, "colors", "header_text") || "#0f172a",
    footerBackground:
      themeValue(tokens, "colors", "footer_background") || "#0f172a",
    footerText: themeValue(tokens, "colors", "footer_text") || "#f8fafc",
    sidebarBackground:
      themeValue(tokens, "colors", "sidebar_background") || "#f8fafc",
    sidebarText: themeValue(tokens, "colors", "sidebar_text") || "#0f172a",
    headingFont: fontStack(themeValue(tokens, "typography", "heading_font")),
    bodyFont: fontStack(themeValue(tokens, "typography", "body_font")),
    baseSize:
      BASE_SIZE[themeValue(tokens, "typography", "base_size")] ?? "16px",
    headingSize:
      HEADING_SIZE[themeValue(tokens, "typography", "heading_scale")] ?? "32px",
    headingWeight: HEADING_WEIGHT[fontWeight] ?? 600,
    bodyWeight: HEADING_WEIGHT[fontWeight] ?? 400,
    lineHeight:
      LINE_HEIGHT[themeValue(tokens, "typography", "line_height")] ?? 1.5,
    letterSpacing:
      LETTER_SPACING[themeValue(tokens, "typography", "letter_spacing")] ?? "0",
    textAlign: align === "center" ? "center" : "left",
    textTransform:
      transform === "uppercase"
        ? "uppercase"
        : transform === "capitalize"
          ? "capitalize"
          : "none",
    contentWidth:
      CONTENT_WIDTH[themeValue(tokens, "spacing", "content_width")] ?? "768px",
    sectionPadding:
      SECTION_PADDING[themeValue(tokens, "spacing", "section_spacing")] ??
      "48px",
    containerPadding:
      CONTAINER_PADDING[themeValue(tokens, "spacing", "container_padding")] ??
      "16px",
    gridGap: GRID_GAP[themeValue(tokens, "spacing", "grid_gap")] ?? "12px",
    cardBackground:
      cardBackground === "page"
        ? pageColor
        : cardBackground === "transparent"
          ? "transparent"
          : surface,
    cardBorder:
      cardPreset === "none"
        ? "none"
        : cardPreset === "thick"
          ? `2px solid ${border}`
          : `1px solid ${border}`,
    cardRadius: RADIUS[themeValue(tokens, "cards", "radius")] ?? "8px",
    cardShadow: SHADOW[themeValue(tokens, "cards", "shadow")] ?? DEFAULT_SHADOW,
    cardPadding: CARD_PADDING[themeValue(tokens, "cards", "padding")] ?? "16px",
    globalBorder:
      globalWidth === "0px" ? "none" : `${globalWidth} solid ${border}`,
    globalRadius: RADIUS[themeValue(tokens, "borders", "radius")] ?? "8px",
    globalShadow:
      SHADOW[themeValue(tokens, "borders", "shadow")] ?? DEFAULT_SHADOW,
    buttonRadius:
      BUTTON_RADIUS[themeValue(tokens, "buttons", "shape")] ?? "8px",
    buttonPadding:
      BUTTON_PADDING[themeValue(tokens, "buttons", "size")] ?? "10px 20px",
  };
}

export interface PreviewSocialLink {
  platform: string;
  url: string;
}

/**
 * Global-layout values the preview renders (header, footer, sidebar,
 * branding, social). Runtime-only behaviour — sticky scrolling, responsive
 * sidebar collapse, the favicon, and link destinations — is deliberately not
 * part of this structure because a static preview cannot demonstrate it; the
 * editor labels those controls as published-site settings instead.
 */
export interface PreviewChrome {
  headerVisible: boolean;
  headerLayout: "left" | "center" | "split";
  showLogo: boolean;
  showNavigation: boolean;
  ctaLabel: string;
  footerVisible: boolean;
  footerLayout: "simple" | "columns";
  copyright: string;
  showSocial: boolean;
  sidebarVisible: boolean;
  sidebarPosition: "left" | "right";
  sidebarWidth: string;
  logoText: string;
  logoImageUrl: string;
  tagline: string;
  socialLinks: PreviewSocialLink[];
}

function socialLinksOf(
  components: ThemeValues | undefined,
): PreviewSocialLink[] {
  const raw = components?.social?.links;
  if (!Array.isArray(raw)) {
    return [];
  }
  const links: PreviewSocialLink[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url : "";
    if (!url) continue;
    links.push({
      platform:
        typeof record.platform === "string" ? record.platform : "website",
      url,
    });
  }
  return links;
}

/** Read the saved site-chrome options the preview renders. */
export function buildPreviewChrome(
  components: ThemeValues | undefined,
): PreviewChrome {
  const layout = themeValue(components, "header", "layout");
  const footerLayout = themeValue(components, "footer", "layout");
  const position = themeValue(components, "sidebar", "position");
  return {
    headerVisible: themeFlag(components, "header", "visible", true),
    headerLayout: layout === "center" || layout === "split" ? layout : "left",
    showLogo: themeFlag(components, "header", "show_logo", true),
    showNavigation: themeFlag(components, "header", "show_navigation", true),
    ctaLabel: themeValue(components, "header", "cta_label"),
    footerVisible: themeFlag(components, "footer", "visible", true),
    footerLayout: footerLayout === "columns" ? "columns" : "simple",
    copyright: themeValue(components, "footer", "copyright"),
    showSocial: themeFlag(components, "footer", "show_social", true),
    sidebarVisible: themeFlag(components, "sidebar", "visible"),
    sidebarPosition: position === "right" ? "right" : "left",
    sidebarWidth:
      SIDEBAR_WIDTH[themeValue(components, "sidebar", "width")] ?? "208px",
    logoText: themeValue(components, "branding", "logo_text") || "Your Name",
    logoImageUrl: themeValue(components, "branding", "logo_image_url"),
    tagline: themeValue(components, "branding", "tagline"),
    socialLinks: socialLinksOf(components),
  };
}
