import { tenantClient } from '@/api/tenantClient';
import type {
  Count, CountInput, CountPage, CountEntry, UnexpectedEntry, DocHistoryEntry,
} from '@/types/inventory';
import type { FilterClause, SortKey } from '@/types/tenant';

export interface CountSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface CountWithNext {
  count: Count;
  nextStatuses: string[];
}

// Cycle-count / physical stock-take document (ICNT) — `inventory_count` RBAC
// resource, `approve` its own grant. DRFT -> CNTG -> RVW_ -> APPV -> POST.
// Freezing snapshots the lines and blocks movement in the counted scope.
const BASE = '/tenant/inventory/counts';

function unwrap(data: { success: boolean; count: Count; nextStatuses?: string[] }): CountWithNext {
  return { count: data.count, nextStatuses: data.nextStatuses ?? [] };
}

export const inventoryCountService = {
  list: (): Promise<CountPage> =>
    tenantClient
      .get<{ success: boolean; records: Count[]; nextCursor: string; hasMore: boolean }>(BASE)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  search: (req: CountSearchRequest): Promise<CountPage> =>
    tenantClient
      .post<{ success: boolean; records: Count[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  get: (uuid: string): Promise<CountWithNext> =>
    tenantClient
      .get<{ success: boolean; count: Count; nextStatuses?: string[] }>(`${BASE}/${uuid}`)
      .then((r) => unwrap(r.data)),

  create: (payload: CountInput): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(BASE, payload)
      .then((r) => r.data.count),

  update: (uuid: string, payload: CountInput): Promise<Count> =>
    tenantClient
      .patch<{ success: boolean; count: Count }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.count),

  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Snapshots what the system believes onto every line. Nothing can be
  // counted before this call.
  freeze: (uuid: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(`${BASE}/${uuid}/freeze`, {})
      .then((r) => r.data.count),

  recordCounts: (uuid: string, entries: CountEntry[]): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(`${BASE}/${uuid}/counts`, { entries })
      .then((r) => r.data.count),

  // A unit found in scope that the frozen snapshot did not list — flagged
  // isUnexpected on return (usually a misfiled location, not found stone).
  addUnexpected: (uuid: string, payload: UnexpectedEntry): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(`${BASE}/${uuid}/unexpected`, payload)
      .then((r) => r.data.count),

  // Body key is `status` (not `toStatusCode`) — matches
  // inventory_counts.go's Transition handler.
  transition: (uuid: string, status: string, note?: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(`${BASE}/${uuid}/transition`, { status, note })
      .then((r) => r.data.count),

  post: (uuid: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: Count }>(`${BASE}/${uuid}/post`, {})
      .then((r) => r.data.count),

  getHistory: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; history: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.history ?? []),
};
