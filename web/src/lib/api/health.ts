import { apiFetch } from "@/lib/api/client";
import type { HealthResponse } from "@/types/health";

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { signal });
}
