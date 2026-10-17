/**
 * Section editor types.
 *
 * These mirror the backend section registry (`GET /section-types`) and the
 * persisted `page_sections` records. The editor is driven entirely by the
 * registry descriptors, so no section shape is hardcoded in the frontend.
 */

export type SectionFieldKind =
  "text" | "textarea" | "url" | "boolean" | "select" | "repeater";

export interface SectionField {
  name: string;
  kind: SectionFieldKind;
  label: string;
  required: boolean;
  max_length: number | null;
  options: string[];
  default: unknown;
  placeholder: string | null;
  help_text: string | null;
  item_label: string | null;
  max_items: number;
  fields: SectionField[];
}

/** Stored section content, keyed by field name. */
export type SectionContent = Record<string, unknown>;

/** Stored section layout settings, keyed by field name. */
export type SectionLayout = Record<string, unknown>;

export interface SectionType {
  type_id: string;
  label: string;
  description: string;
  group: string;
  schema_version: number;
  content_fields: SectionField[];
  layout_fields: SectionField[];
  default_content: SectionContent;
  default_layout: SectionLayout;
}

export interface PageSection {
  id: string;
  page_id: string;
  section_type: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
  content: SectionContent;
  layout: SectionLayout;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface SectionCreatePayload {
  section_type: string;
  name?: string;
  is_visible?: boolean;
  content?: SectionContent;
  layout?: SectionLayout;
}

export interface SectionUpdatePayload {
  name?: string;
  is_visible?: boolean;
  content?: SectionContent;
  layout?: SectionLayout;
}
