/** Media asset types mirroring the backend `media_assets` records. */

export interface MediaAsset {
  id: string;
  portfolio_id: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaUpdatePayload {
  alt_text?: string | null;
  caption?: string | null;
}
