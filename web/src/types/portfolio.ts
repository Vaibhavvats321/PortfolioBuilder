export type PortfolioStatus = "draft" | "published";

export interface Portfolio {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: PortfolioStatus;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  current_published_version_id: string | null;
}

export interface PortfolioCreatePayload {
  name: string;
  slug?: string;
  description?: string;
}

export interface PortfolioUpdatePayload {
  name?: string;
  slug?: string;
  description?: string | null;
}
