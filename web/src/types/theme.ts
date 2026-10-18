/**
 * Theme editor types.
 *
 * These mirror the backend theme registry (`GET /theme/options`) and the
 * persisted `theme_configs` records. The Design Studio is driven entirely by
 * the registry descriptors, so no design shape is hardcoded in the frontend.
 */

import type { SectionField } from "@/types/section";

/** A group of design fields (for example `colors` or `header`). */
export interface ThemeGroup {
  name: string;
  label: string;
  description: string;
  fields: SectionField[];
  default: Record<string, unknown>;
}

/** Validated design values for one slice, keyed by group then field. */
export type ThemeValues = Record<string, Record<string, unknown>>;

export interface ThemeOptions {
  schema_version: number;
  token_groups: ThemeGroup[];
  layout_groups: ThemeGroup[];
  default_tokens: ThemeValues;
  default_components: ThemeValues;
}

export interface Theme {
  portfolio_id: string;
  schema_version: number;
  tokens: ThemeValues;
  components: ThemeValues;
  updated_at: string;
}

export interface GlobalLayout {
  portfolio_id: string;
  schema_version: number;
  components: ThemeValues;
  updated_at: string;
}

export interface ThemeUpdatePayload {
  tokens: ThemeValues;
}

export interface GlobalLayoutUpdatePayload {
  components: ThemeValues;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  tokens: ThemeValues;
  components: ThemeValues;
}
