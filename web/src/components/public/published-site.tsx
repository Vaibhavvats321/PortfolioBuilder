import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { SectionPreview } from "@/components/builder/section-preview";
import {
  publicHomePath,
  publicNavEntries,
  type PublicNavEntry,
} from "@/lib/public/site";
import { buildPreviewChrome, buildPreviewTheme } from "@/lib/theme/style";
import type { PortfolioPreview, PreviewPage } from "@/types/preview";

export interface PublishedSiteProps {
  /** Active published snapshot bundle. */
  site: PortfolioPreview;
  /** Page resolved from the same bundle (homepage or a nested page). */
  page: PreviewPage;
}

function SiteNav({
  entries,
  ariaLabel,
  className,
  style,
}: {
  entries: PublicNavEntry[];
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <nav aria-label={ariaLabel} className={className} style={style}>
      {entries.map((entry) =>
        entry.href === null ? (
          <span key={entry.id}>{entry.label}</span>
        ) : entry.href.startsWith("/") ? (
          <Link key={entry.id} href={entry.href} className="hover:underline">
            {entry.label}
          </Link>
        ) : (
          <a key={entry.id} href={entry.href} className="hover:underline">
            {entry.label}
          </a>
        ),
      )}
    </nav>
  );
}

/**
 * Server-rendered public portfolio site. It consumes only the published
 * snapshot bundle and the same shared theme/section pieces the editor
 * previews use, so what owners preview is exactly what visitors see. No
 * client-side JavaScript is required to render or navigate it.
 */
export function PublishedSite({ site, page }: PublishedSiteProps) {
  const t = buildPreviewTheme(site.theme.tokens);
  const chrome = buildPreviewChrome(site.theme.components);
  const homePath = publicHomePath(site.portfolio.slug);

  const pageStyle = {
    background: t.pageBackground,
    color: t.text,
    fontFamily: t.bodyFont,
    fontSize: t.baseSize,
    fontWeight: t.bodyWeight,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textAlign: t.textAlign,
    borderColor: t.border,
    "--pb-link": t.link,
    "--pb-link-hover": t.linkHover,
  } as CSSProperties;

  const primaryButton: CSSProperties = {
    background: t.buttonBackground,
    color: t.buttonText,
    borderRadius: t.buttonRadius,
    padding: t.buttonPadding,
  };

  const headerEntries = chrome.showNavigation
    ? publicNavEntries(site, "header")
    : [];
  const sidebarEntries = publicNavEntries(site, "sidebar");
  const footerEntries = publicNavEntries(site, "footer");

  const brand = chrome.logoImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user-provided logo URL.
    <img
      src={chrome.logoImageUrl}
      alt={chrome.logoText}
      className="h-6 w-auto"
    />
  ) : (
    <Link href={homePath} className="font-semibold hover:underline">
      {chrome.logoText}
    </Link>
  );

  const headerCta = chrome.ctaLabel ? (
    <span className="inline-block text-xs font-medium" style={primaryButton}>
      {chrome.ctaLabel}
    </span>
  ) : null;

  const header = chrome.headerVisible ? (
    <header
      className={`flex flex-wrap items-center gap-4 px-4 py-3 ${chrome.headerLayout === "center" ? "justify-center" : "justify-between"}`}
      style={{
        background: t.headerBackground,
        color: t.headerText,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      {chrome.headerLayout === "left" ? (
        <>
          {brand}
          <div className="flex items-center gap-4">
            <SiteNav
              entries={headerEntries}
              ariaLabel={`${site.portfolio.name} header navigation`}
              className="flex flex-wrap gap-3 text-sm"
            />
            {headerCta}
          </div>
        </>
      ) : (
        <>
          {brand}
          <SiteNav
            entries={headerEntries}
            ariaLabel={`${site.portfolio.name} header navigation`}
            className="flex flex-wrap gap-3 text-sm"
          />
          {headerCta}
        </>
      )}
    </header>
  ) : null;

  const sidebar = chrome.sidebarVisible ? (
    <aside
      className="shrink-0 px-3 py-4 text-sm"
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
      <Link href={homePath} className="font-semibold hover:underline">
        {chrome.logoText}
      </Link>
      <SiteNav
        entries={sidebarEntries}
        ariaLabel={`${site.portfolio.name} sidebar navigation`}
        className="mt-3 flex flex-col gap-2"
        style={{ color: t.link }}
      />
    </aside>
  ) : null;

  const sections = (
    <section
      style={{
        paddingTop: t.sectionPadding,
        paddingBottom: t.sectionPadding,
        paddingLeft: t.containerPadding,
        paddingRight: t.containerPadding,
      }}
    >
      <div
        className="space-y-4"
        style={{ maxWidth: t.contentWidth, marginInline: "auto" }}
      >
        {page.sections
          .filter((section) => section.is_visible)
          .map((section) => (
            <SectionPreview key={section.id} section={section} />
          ))}
      </div>
    </section>
  );

  const footer: ReactNode = chrome.footerVisible ? (
    <footer
      className="px-4 py-3 text-xs"
      style={{ background: t.footerBackground, color: t.footerText }}
    >
      <div
        className={
          chrome.footerLayout === "columns"
            ? "flex flex-wrap items-start justify-between gap-4"
            : "space-y-2"
        }
      >
        <div>
          <p className="font-medium">{chrome.logoText}</p>
          {chrome.tagline ? (
            <p style={{ opacity: 0.75 }}>{chrome.tagline}</p>
          ) : null}
          {chrome.footerLayout !== "columns" && footerEntries.length > 0 ? (
            <SiteNav
              entries={footerEntries}
              ariaLabel={`${site.portfolio.name} footer navigation`}
              className="mt-2 flex flex-wrap gap-3"
            />
          ) : null}
        </div>
        {chrome.footerLayout === "columns" && footerEntries.length > 0 ? (
          <SiteNav
            entries={footerEntries}
            ariaLabel={`${site.portfolio.name} footer navigation`}
            className="flex flex-wrap gap-3"
          />
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
              <a
                key={`${index}-${link.url}`}
                href={link.url}
                className="rounded px-2 py-0.5 hover:underline"
                style={{ border: `1px solid ${t.border}`, color: t.link }}
              >
                {link.platform}
              </a>
            ))}
          </span>
        ) : null}
      </div>
    </footer>
  ) : null;

  return (
    <div className="min-h-screen" style={pageStyle}>
      {header}
      <div className="flex">
        {chrome.sidebarPosition === "left" ? sidebar : null}
        <main className="min-w-0 flex-1">{sections}</main>
        {chrome.sidebarPosition === "right" ? sidebar : null}
      </div>
      {footer}
    </div>
  );
}
