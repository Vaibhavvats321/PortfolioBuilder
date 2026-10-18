/**
 * Draft preview bundle types.
 *
 * These mirror the backend `GET /portfolios/{id}/preview` response: the
 * latest draft of every page with sections, navigation, theme, and media.
 * Pages and sections reuse the editor shapes because the preview payload
 * carries the same fields as the draft-editing endpoints.
 */

import type { NavigationItem } from "@/types/navigation";
import type { PortfolioStatus } from "@/types/portfolio";
import type { PageSection } from "@/types/section";
import type { ThemeValues } from "@/types/theme";

export interface PreviewPortfolio {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: PortfolioStatus;
  published_at: string | null;
}

export interface PreviewPage {
  id: string;
  title: string;
  slug: string;
  is_homepage: boolean;
  is_visible: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  sections: PageSection[];
}

export interface PreviewTheme {
  schema_version: number;
  tokens: ThemeValues;
  components: ThemeValues;
}

export interface PreviewMedia {
  id: string;
  original_filename: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  /** Stable relative URL serving the asset's bytes (`/media/{id}/file`). */
  url: string;
}

export interface PortfolioPreview {
  portfolio: PreviewPortfolio;
  pages: PreviewPage[];
  navigation: NavigationItem[];
  theme: PreviewTheme;
  media: PreviewMedia[];
}
