// Cross-module global search — the GET /api/tenant/search contract.
// See backend globalsearch/ (registry.go Result, search.go Response).

// One match. `domain`/`module` are the frontend route segments the backend
// resolved for this entity type (NOT always == `type`, e.g. fabrication_job ->
// sales/installation) — feed them straight to recordRoute(domain, module, id).
export interface SearchHit {
  type: string;
  id: string;
  number?: string;
  displayName: string;
  subtitle?: string;
  updatedAt: string;
  domain: string;
  module: string;
}

export interface SearchGroup {
  results: SearchHit[];
  hasMore: boolean;
}

export interface GlobalSearchResponse {
  query: string;
  // keyed by entity type (e.g. "invoice", "customer", "user")
  groups: Record<string, SearchGroup>;
}
