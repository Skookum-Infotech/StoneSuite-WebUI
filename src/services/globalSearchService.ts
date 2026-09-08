import { tenantClient } from '@/api/tenantClient';
import type { GlobalSearchResponse } from '@/types/search';

// Minimum characters before the backend will run a search (mirrors
// controllers/globalsearch.go minSearchTermLen).
export const MIN_SEARCH_CHARS = 2;

// Per-group cap the full results page asks for (backend clamps to 50).
export const RESULTS_PAGE_LIMIT = 50;

interface SearchOpts {
  modules?: string[];
  limit?: number;
}

export const globalSearchService = {
  // Fans the term out across every module the caller can read; results come
  // back grouped by entity type, each group capped at `limit` (default ~6) with
  // a hasMore flag. `modules` optionally restricts the fan-out to those keys.
  search: (term: string, opts: SearchOpts = {}): Promise<GlobalSearchResponse> => {
    const params: Record<string, string> = { q: term };
    if (opts.modules?.length) params.modules = opts.modules.join(',');
    if (opts.limit) params.limit = String(opts.limit);
    return tenantClient
      .get<{ success: boolean } & GlobalSearchResponse>('/tenant/search', { params })
      .then((r) => ({
        query: r.data.query ?? term,
        groups: r.data.groups ?? {},
      }));
  },
};
