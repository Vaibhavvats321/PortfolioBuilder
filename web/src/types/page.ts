export type PageStatus = "draft" | "published";

export interface Page {
  id: string;
  portfolio_id: string;
  title: string;
  slug: string;
  is_homepage: boolean;
  is_visible: boolean;
  status: PageStatus;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageCreatePayload {
  title: string;
  slug?: string;
  is_homepage?: boolean;
  is_visible?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface PageUpdatePayload {
  title?: string;
  slug?: string;
  is_homepage?: boolean;
  is_visible?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}
