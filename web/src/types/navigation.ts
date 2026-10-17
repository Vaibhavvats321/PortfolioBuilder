export type NavigationLocation = "header" | "footer" | "sidebar";
export type NavigationDestinationType = "page" | "external_url";

export interface NavigationItem {
  id: string;
  portfolio_id: string;
  location: NavigationLocation;
  label: string;
  destination_type: NavigationDestinationType;
  page_id: string | null;
  external_url: string | null;
  sort_order: number;
  is_visible: boolean;
}

export interface NavigationItemInput {
  location: NavigationLocation;
  label: string;
  destination_type: NavigationDestinationType;
  page_id?: string | null;
  external_url?: string | null;
  is_visible?: boolean;
}
