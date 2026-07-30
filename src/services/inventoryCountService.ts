import { tenantClient } from '@/api/tenantClient';
import { withLines } from '@/lib/inventoryDocumentLines';
import type {
  Count, CountLine, CountInput, CountPage, CountEntry, UnexpectedEntry, DocHistoryEntry,
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

// `lines` is absent from the payload until the count has some — see withLines.
type CountWire = Omit<Count, 'lines'> & { lines?: CountLine[] };

function normalize(c: CountWire): Count {
  return withLines<CountLine, CountWire>(c);
}

function unwrap(data: { success: boolean; count: CountWire; nextStatuses?: string[] }): CountWithNext {
  return { count: normalize(data.count), nextStatuses: data.nextStatuses ?? [] };
}

export const inventoryCountService = {
  list: (): Promise<CountPage> =>
    tenantClient
      .get<{ success: boolean; records: CountWire[]; nextCursor: string; hasMore: boolean }>(BASE)
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  search: (req: CountSearchRequest): Promise<CountPage> =>
    tenantClient
      .post<{ success: boolean; records: CountWire[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  get: (uuid: string): Promise<CountWithNext> =>
    tenantClient
      .get<{ success: boolean; count: CountWire; nextStatuses?: string[] }>(`${BASE}/${uuid}`)
      .then((r) => unwrap(r.data)),

  create: (payload: CountInput): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(BASE, payload)
      .then((r) => normalize(r.data.count)),

  update: (uuid: string, payload: CountInput): Promise<Count> =>
    tenantClient
      .patch<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}`, payload)
      .then((r) => normalize(r.data.count)),

  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Snapshots what the system believes onto every line. Nothing can be
  // counted before this call.
  freeze: (uuid: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}/freeze`, {})
      .then((r) => normalize(r.data.count)),

  recordCounts: (uuid: string, entries: CountEntry[]): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}/counts`, { entries })
      .then((r) => normalize(r.data.count)),

  // A unit found in scope that the frozen snapshot did not list — flagged
  // isUnexpected on return (usually a misfiled location, not found stone).
  addUnexpected: (uuid: string, payload: UnexpectedEntry): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}/unexpected`, payload)
      .then((r) => normalize(r.data.count)),

  // Body key is `status` (not `toStatusCode`) — matches
  // inventory_counts.go's Transition handler.
  transition: (uuid: string, status: string, note?: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}/transition`, { status, note })
      .then((r) => normalize(r.data.count)),

  post: (uuid: string): Promise<Count> =>
    tenantClient
      .post<{ success: boolean; count: CountWire }>(`${BASE}/${uuid}/post`, {})
      .then((r) => normalize(r.data.count)),

  getHistory: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
