"use client";

import type { CSSProperties } from "react";

import { buildPreviewChrome, buildPreviewTheme } from "@/lib/theme/style";
import type { ThemeValues } from "@/types/theme";

interface ThemePreviewProps {
  tokens: ThemeValues;
  components: ThemeValues;
}

const NAV_ITEMS = ["Work", "About", "Contact"];

const TILES = [
  { label: "Projects shipped", value: "24" },
  { label: "Years of experience", value: "8" },
];

/**
 * A small, self-contained mock of the public site used to preview the global
 * theme tokens and the saved global layout. It renders representative chrome
 * (header, sidebar, hero, buttons, tiles, card, link, footer) rather than any
 * real portfolio content, so it is safe to show while editing and never
 * exposes another portfolio's data.
 *
 * Every control exposed by the Design Studio maps onto something visible here.
 * Options a static mock cannot demonstrate (sticky scrolling, responsive
 * collapse, favicon, link destinations) are labelled in the editor as
 * published-site settings instead.
 */
export function ThemePreview({ tokens, components }: ThemePreviewProps) {
  const t = buildPreviewTheme(tokens);
  const chrome = buildPreviewChrome(components);

  const page: CSSProperties = {
    background: t.pageBackground,
    color: t.text,
    fontFamily: t.bodyFont,
    fontSize: t.baseSize,
    fontWeight: t.bodyWeight,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textAlign: t.textAlign,
    borderColor: t.border,
  };

  const heading: CSSProperties = {
    fontFamily: t.headingFont,
    fontSize: t.headingSize,
    fontWeight: t.headingWeight,
    textTransform: t.textTransform,
    color: "inherit",
  };

  const primaryButton: CSSProperties = {
    background: t.buttonBackground,
    color: t.buttonText,
    borderRadius: t.buttonRadius,
    padding: t.buttonPadding,
  };

  const secondaryButton: CSSProperties = {
    background: t.secondary,
    color: t.buttonText,
    borderRadius: t.buttonRadius,
    padding: t.buttonPadding,
  };

  const card: CSSProperties = {
    background: t.cardBackground,
    border: t.cardBorder,
    borderRadius: t.cardRadius,
    boxShadow: t.cardShadow,
    padding: t.cardPadding,
  };

  const brand = chrome.logoImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user-provided logo URL; optimized media arrives with the media library (Phase 6).
    <img
      src={chrome.logoImageUrl}
      alt={chrome.logoText}
      className="h-6 w-auto"
    />
  ) : (
    <span className="font-semibold">{chrome.logoText}</span>
  );

  const nav = chrome.showNavigation ? (
    <nav className="flex gap-3 text-xs" aria-label="Preview navigation">
      {NAV_ITEMS.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </nav>
  ) : null;

  const headerCta = chrome.ctaLabel ? (
    <span className="inline-block text-xs font-medium" style={primaryButton}>
      {chrome.ctaLabel}
    </span>
  ) : null;

  const header = chrome.headerVisible ? (
    <header
      className={`flex items-center gap-4 px-4 py-3 ${chrome.headerLayout === "center" ? "justify-center" : "justify-between"}`}
      style={{
        background: t.headerBackground,
        color: t.headerText,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      {chrome.headerLayout === "left" ? (
        <>
          {brand}
          <div className="ml-auto flex items-center gap-4">
            {nav}
            {headerCta}
          </div>
        </>
      ) : (
        <>
          {brand}
          {nav}
          {headerCta}
        </>
      )}
    </header>
  ) : null;

  const sidebar = chrome.sidebarVisible ? (
    <aside
      className="shrink-0 px-3 py-4 text-xs"
      style={{
        width: chrome.sidebarWidth,
        background: t.sidebarBackground,
        color: t.sidebarText,
        borderRight:
          chrome.sidebarPosition === "left"
            ? `1px solid ${t.border}`
            : undefined,
        borderLeft:
          chrome.sidebarPosition === "right"
            ? `1px solid ${t.border}`
            : undefined,
      }}
    >
      <p className="font-semibold">{chrome.logoText}</p>
      <nav className="mt-3 flex flex-col gap-2" aria-label="Preview sidebar">
        {NAV_ITEMS.map((item) => (
          <span key={item} style={{ color: t.link }}>
            {item}
          </span>
        ))}
      </nav>
    </aside>
  ) : null;

  const linkClassName = [
    "pb-preview-link",
    "inline-block",
    t.linkUnderline === "always"
      ? "underline"
      : t.linkUnderline === "hover"
        ? "hover:underline"
        : "",
    t.linkStyle === "bold" ? "font-bold" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <section
      style={{
        paddingTop: t.sectionPadding,
        paddingBottom: t.sectionPadding,
        paddingLeft: t.containerPadding,
        paddingRight: t.containerPadding,
      }}
    >
      <div
        className="space-y-3"
        style={{ maxWidth: t.contentWidth, marginInline: "auto" }}
      >
        <p style={heading}>Design that speaks</p>
        <p style={{ color: t.mutedText }}>
          A short introduction previewing your typography, spacing, and colors.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-block text-xs font-medium"
            style={primaryButton}
          >
            Get in touch
          </span>
          <span
            className="inline-block text-xs font-medium"
            style={secondaryButton}
          >
            Learn more
          </span>
          <span
            className="rounded-full px-2 py-1 text-xs"
            style={{ background: t.accent, color: t.text }}
          >
            Available
          </span>
        </div>
        <div className="grid grid-cols-2" style={{ gap: t.gridGap }}>
          {TILES.map((tile) => (
            <div
              key={tile.label}
              style={{
                border: t.globalBorder,
                borderRadius: t.globalRadius,
                boxShadow: t.globalShadow,
                padding: "12px",
              }}
            >
              <p className="text-xs" style={{ color: t.mutedText }}>
                {tile.label}
              </p>
              <p className="mt-1 font-semibold">{tile.value}</p>
            </div>
          ))}
        </div>
        <div style={card}>
          <p className="font-medium">Featured project</p>
          <p className="mt-1 text-xs" style={{ color: t.mutedText }}>
            A card preview using the surface, border, radius, shadow, and
            padding tokens.
          </p>
          <a
            href="https://example.com"
            onClick={(event) => event.preventDefault()}
            className={`mt-2 ${linkClassName}`}
          >
            View project →
          </a>
        </div>
      </div>
    </section>
  );

  const footer = chrome.footerVisible ? (
    <footer
      className="px-4 py-3 text-xs"
      style={{ background: t.footerBackground, color: t.footerText }}
    >
      <div
        className={
          chrome.footerLayout === "columns"
            ? "flex flex-wrap items-start justify-between gap-4"
            : "space-y-1"
        }
      >
        <div>
          <p className="font-medium">{chrome.logoText}</p>
          {chrome.tagline ? (
            <p style={{ opacity: 0.75 }}>{chrome.tagline}</p>
          ) : null}
        </div>
        {chrome.footerLayout === "columns" ? (
          <div className="flex gap-3">
            {NAV_ITEMS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          {chrome.copyright ||
            `© ${new Date().getFullYear()} ${chrome.logoText}`}
        </span>
        {chrome.showSocial && chrome.socialLinks.length > 0 ? (
          <span className="flex flex-wrap gap-2">
            {chrome.socialLinks.map((link, index) => (
              <span
                key={`${index}-${link.url}`}
                className="rounded px-2 py-0.5"
                style={{ border: `1px solid ${t.border}`, color: t.link }}
              >
                {link.platform}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </footer>
  ) : null;

  return (
    <div
      className="overflow-hidden rounded-lg border text-sm"
      style={
        {
          ...page,
          "--pb-link": t.link,
          "--pb-link-hover": t.linkHover,
        } as CSSProperties
      }
      aria-label="Theme preview"
    >
      {header}
      <div className="flex">
        {chrome.sidebarPosition === "left" ? sidebar : null}
        <div className="min-w-0 flex-1">{body}</div>
        {chrome.sidebarPosition === "right" ? sidebar : null}
      </div>
      {footer}
    </div>
  );
}
