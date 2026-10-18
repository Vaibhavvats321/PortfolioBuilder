import type { ComponentType, ReactNode } from "react";

import {
  DEFAULT_BREAKPOINT,
  resolveSectionStyle,
  type ResponsiveBreakpoint,
} from "@/lib/section/responsive";
import { sectionStyleToCss, sectionTextStyle } from "@/lib/theme/style";
import type { PageSection, SectionType } from "@/types/section";

export interface SectionPreviewProps {
  section: PageSection;
  sectionType?: SectionType;
  /** Breakpoint used to resolve responsive style overrides. */
  breakpoint?: ResponsiveBreakpoint;
}

/**
 * Preview frame widths so the selected breakpoint is visible while editing:
 * desktop fills the panel, tablet and mobile constrain it to the device width
 * the responsive overrides target.
 */
const PREVIEW_MAX_WIDTH: Record<ResponsiveBreakpoint, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

/**
 * Shared preview surface. It applies the section's stored style overrides
 * (background, text color, spacing, width, radius, shadow, border) so the
 * inspector's "Style overrides" controls are reflected in the editor preview.
 * `"inherit"` values produce no override and keep the neutral preview styling.
 *
 * Renderers also spread `sectionTextStyle(section)` over their headings and
 * paragraphs: the card only sets the inherited color, while preview text
 * carries its own color classes, so the override has to sit on the elements
 * themselves. Elements that pair a background with a contrasting text color
 * (such as the hero availability badge) intentionally skip it.
 */
function PreviewCard({
  section,
  children,
  compact = false,
}: {
  section: PageSection;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={sectionStyleToCss(section.style)}
      className={`rounded-md border border-slate-200 bg-white ${compact ? "p-4" : "p-6"} dark:border-slate-700 dark:bg-slate-900`}
    >
      {children}
    </div>
  );
}

export function UnknownSectionRenderer({ section }: SectionPreviewProps) {
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section} compact>
      <p
        className="font-medium text-slate-700 dark:text-slate-200"
        style={textStyle}
      >
        {section.name}
      </p>
      <p
        className="mt-1 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        Unsupported section type: {section.section_type}
      </p>
    </PreviewCard>
  );
}

export function HeroRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const subheading =
    typeof content.subheading === "string" ? content.subheading : "";
  const body = typeof content.body === "string" ? content.body : "";
  const showAvailability =
    typeof content.show_availability === "boolean"
      ? content.show_availability
      : false;
  const availabilityText =
    typeof content.availability_text === "string"
      ? content.availability_text
      : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-xl font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      {subheading ? (
        <p
          className="mt-2 text-sm text-slate-600 dark:text-slate-400"
          style={textStyle}
        >
          {subheading}
        </p>
      ) : null}
      {body ? (
        <p
          className="mt-3 text-sm text-slate-700 dark:text-slate-200"
          style={textStyle}
        >
          {body}
        </p>
      ) : null}
      {showAvailability && availabilityText ? (
        <span className="mt-4 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
          {availabilityText}
        </span>
      ) : null}
    </PreviewCard>
  );
}

export function RichTextRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const body = typeof content.body === "string" ? content.body : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      {body ? (
        <p
          className="mt-2 text-sm text-slate-700 dark:text-slate-200"
          style={textStyle}
        >
          {body}
        </p>
      ) : null}
    </PreviewCard>
  );
}

export function CallToActionRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const body = typeof content.body === "string" ? content.body : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      {body ? (
        <p
          className="mt-2 text-sm text-slate-700 dark:text-slate-200"
          style={textStyle}
        >
          {body}
        </p>
      ) : null}
    </PreviewCard>
  );
}

export function ContactDetailsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const email = typeof content.email === "string" ? content.email : "";
  const phone = typeof content.phone === "string" ? content.phone : "";
  const location = typeof content.location === "string" ? content.location : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <div
        className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200"
        style={textStyle}
      >
        {email ? <p>Email: {email}</p> : null}
        {phone ? <p>Phone: {phone}</p> : null}
        {location ? <p>Location: {location}</p> : null}
      </div>
    </PreviewCard>
  );
}

export function ImageTextRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const body = typeof content.body === "string" ? content.body : "";
  const imageUrl =
    typeof content.image_url === "string" ? content.image_url : "";
  const imageAlt =
    typeof content.image_alt === "string" ? content.image_alt : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external URLs are user-provided; the media library (Phase 6) will add optimized uploads.
        <img
          src={imageUrl}
          alt={imageAlt}
          className="mt-3 max-h-48 w-auto rounded"
        />
      ) : null}
      {body ? (
        <p
          className="mt-2 text-sm text-slate-700 dark:text-slate-200"
          style={textStyle}
        >
          {body}
        </p>
      ) : null}
    </PreviewCard>
  );
}

export function ImageGalleryRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.images) ? content.images.length : 0} image(s)
      </p>
    </PreviewCard>
  );
}

export function ProjectGridRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.projects) ? content.projects.length : 0}{" "}
        project(s)
      </p>
    </PreviewCard>
  );
}

export function SkillsGridRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.skills) ? content.skills.length : 0} skill(s)
      </p>
    </PreviewCard>
  );
}

export function ExperienceTimelineRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.entries) ? content.entries.length : 0} entry(ies)
      </p>
    </PreviewCard>
  );
}

export function TestimonialsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.testimonials) ? content.testimonials.length : 0}{" "}
        testimonial(s)
      </p>
    </PreviewCard>
  );
}

export function MetricsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.metrics) ? content.metrics.length : 0} metric(s)
      </p>
    </PreviewCard>
  );
}

export function LinkListRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section}>
      <h3
        className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        style={textStyle}
      >
        {heading || section.name}
      </h3>
      <p
        className="mt-2 text-sm text-slate-500 dark:text-slate-400"
        style={textStyle}
      >
        {Array.isArray(content.links) ? content.links.length : 0} link(s)
      </p>
    </PreviewCard>
  );
}

export function DividerRenderer({ section }: SectionPreviewProps) {
  const textStyle = sectionTextStyle(section.style);
  return (
    <PreviewCard section={section} compact>
      <p
        className="text-sm text-slate-600 dark:text-slate-400"
        style={textStyle}
      >
        {section.name}
      </p>
      <div className="mt-2 border-t border-slate-300 dark:border-slate-700" />
    </PreviewCard>
  );
}

const RENDERERS: Record<string, ComponentType<SectionPreviewProps>> = {
  hero: HeroRenderer,
  rich_text: RichTextRenderer,
  call_to_action: CallToActionRenderer,
  contact_details: ContactDetailsRenderer,
  image_text: ImageTextRenderer,
  image_gallery: ImageGalleryRenderer,
  project_grid: ProjectGridRenderer,
  skills_grid: SkillsGridRenderer,
  experience_timeline: ExperienceTimelineRenderer,
  testimonials: TestimonialsRenderer,
  metrics: MetricsRenderer,
  link_list: LinkListRenderer,
  divider: DividerRenderer,
};

/**
 * Renders one section for the editor preview. The section's responsive
 * overrides are resolved for the requested breakpoint into a fresh style
 * object — the stored section is never mutated — and the frame is width-
 * constrained so tablet/mobile previews are visibly narrower.
 */
export function SectionPreview({
  section,
  sectionType,
  breakpoint = DEFAULT_BREAKPOINT,
}: SectionPreviewProps) {
  const Renderer = RENDERERS[section.section_type] ?? UnknownSectionRenderer;
  const previewSection: PageSection = {
    ...section,
    style: resolveSectionStyle(section.style, breakpoint),
  };
  return (
    <div
      data-breakpoint={breakpoint}
      style={{
        width: "100%",
        maxWidth: PREVIEW_MAX_WIDTH[breakpoint],
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <Renderer section={previewSection} sectionType={sectionType} />
    </div>
  );
}
