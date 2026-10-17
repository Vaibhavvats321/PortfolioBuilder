import type { ComponentType } from "react";
import type { PageSection, SectionType } from "@/types/section";

export interface SectionPreviewProps {
  section: PageSection;
  sectionType?: SectionType;
}

export function UnknownSectionRenderer({ section }: SectionPreviewProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="font-medium text-slate-700 dark:text-slate-200">
        {section.name}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Unsupported section type: {section.section_type}
      </p>
    </div>
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
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      {subheading ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {subheading}
        </p>
      ) : null}
      {body ? (
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          {body}
        </p>
      ) : null}
      {showAvailability && availabilityText ? (
        <span className="mt-4 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
          {availabilityText}
        </span>
      ) : null}
    </div>
  );
}

export function RichTextRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const body = typeof content.body === "string" ? content.body : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      {body ? (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function CallToActionRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const body = typeof content.body === "string" ? content.body : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      {body ? (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function ContactDetailsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  const email = typeof content.email === "string" ? content.email : "";
  const phone = typeof content.phone === "string" ? content.phone : "";
  const location = typeof content.location === "string" ? content.location : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {email ? <p>Email: {email}</p> : null}
        {phone ? <p>Phone: {phone}</p> : null}
        {location ? <p>Location: {location}</p> : null}
      </div>
    </div>
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
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
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
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function ImageGalleryRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.images) ? content.images.length : 0} image(s)
      </p>
    </div>
  );
}

export function ProjectGridRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.projects) ? content.projects.length : 0}{" "}
        project(s)
      </p>
    </div>
  );
}

export function SkillsGridRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.skills) ? content.skills.length : 0} skill(s)
      </p>
    </div>
  );
}

export function ExperienceTimelineRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.entries) ? content.entries.length : 0} entry(ies)
      </p>
    </div>
  );
}

export function TestimonialsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.testimonials) ? content.testimonials.length : 0}{" "}
        testimonial(s)
      </p>
    </div>
  );
}

export function MetricsRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.metrics) ? content.metrics.length : 0} metric(s)
      </p>
    </div>
  );
}

export function LinkListRenderer({ section }: SectionPreviewProps) {
  const content = section.content as Record<string, unknown>;
  const heading = typeof content.heading === "string" ? content.heading : "";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {heading || section.name}
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {Array.isArray(content.links) ? content.links.length : 0} link(s)
      </p>
    </div>
  );
}

export function DividerRenderer({ section }: SectionPreviewProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {section.name}
      </p>
      <div className="mt-2 border-t border-slate-300 dark:border-slate-700" />
    </div>
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

export function SectionPreview({ section, sectionType }: SectionPreviewProps) {
  const Renderer = RENDERERS[section.section_type] ?? UnknownSectionRenderer;
  return <Renderer section={section} sectionType={sectionType} />;
}
