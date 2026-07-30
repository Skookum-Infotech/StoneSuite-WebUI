import { tenantClient } from '@/api/tenantClient';
import { withLines } from '@/lib/inventoryDocumentLines';
import type { Adjustment, AdjustmentLine, AdjustmentInput, AdjustmentPage, DocHistoryEntry } from '@/types/inventory';
import type { FilterClause, SortKey } from '@/types/tenant';

export interface AdjustmentSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface AdjustmentWithNext {
  adjustment: Adjustment;
  nextStatuses: string[];
}

// Manual stock-correction document (IADJ) — `inventory_adjustment` RBAC
// resource, with `approve` as its own grant separate from `transition`
// (whoever raises a write-off should not be whoever signs it off).
// DRFT -> PAPV -> APPV -> POST. Posting is terminal.
const BASE = '/tenant/inventory/adjustments';

// `lines` is absent from the payload when the document has none — see withLines.
type AdjustmentWire = Omit<Adjustment, 'lines'> & { lines?: AdjustmentLine[] };

function normalize(a: AdjustmentWire): Adjustment {
  return withLines<AdjustmentLine, AdjustmentWire>(a);
}

function unwrap(data: { success: boolean; adjustment: AdjustmentWire; nextStatuses?: string[] }): AdjustmentWithNext {
  return { adjustment: normalize(data.adjustment), nextStatuses: data.nextStatuses ?? [] };
}

export const inventoryAdjustmentService = {
  list: (): Promise<AdjustmentPage> =>
    tenantClient
      .get<{ success: boolean; records: AdjustmentWire[]; nextCursor: string; hasMore: boolean }>(BASE)
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  search: (req: AdjustmentSearchRequest): Promise<AdjustmentPage> =>
    tenantClient
      .post<{ success: boolean; records: AdjustmentWire[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  get: (uuid: string): Promise<AdjustmentWithNext> =>
    tenantClient
      .get<{ success: boolean; adjustment: AdjustmentWire; nextStatuses?: string[] }>(`${BASE}/${uuid}`)
      .then((r) => unwrap(r.data)),

  create: (payload: AdjustmentInput): Promise<Adjustment> =>
    tenantClient
      .post<{ success: boolean; adjustment: AdjustmentWire }>(BASE, payload)
      .then((r) => normalize(r.data.adjustment)),

  // Editable while DRFT; a status-locked edit surfaces the server's message.
  update: (uuid: string, payload: AdjustmentInput): Promise<Adjustment> =>
    tenantClient
      .patch<{ success: boolean; adjustment: AdjustmentWire }>(`${BASE}/${uuid}`, payload)
      .then((r) => normalize(r.data.adjustment)),

  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Render buttons from the GET's nextStatuses rather than hardcoding the
  // machine — the server is authoritative for which move is legal. Body key
  // is `status` (not `toStatusCode`) — matches inventory_adjustments.go's
  // Transition handler.
  transition: (uuid: string, status: string, note?: string): Promise<Adjustment> =>
    tenantClient
      .post<{ success: boolean; adjustment: AdjustmentWire }>(`${BASE}/${uuid}/transition`, { status, note })
      .then((r) => normalize(r.data.adjustment)),

  // Requires APPV. Nothing moves stock until this call; posting is terminal —
  // correcting means raising the opposite adjustment.
  post: (uuid: string): Promise<Adjustment> =>
    tenantClient
      .post<{ success: boolean; adjustment: AdjustmentWire }>(`${BASE}/${uuid}/post`, {})
      .then((r) => normalize(r.data.adjustment)),

  getHistory: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
