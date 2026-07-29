import { tenantClient } from '@/api/tenantClient';
import { withLines } from '@/lib/inventoryDocumentLines';
import type { Transfer, TransferLine, TransferInput, TransferPage, DocHistoryEntry } from '@/types/inventory';
import type { FilterClause, SortKey } from '@/types/tenant';

export interface TransferSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface TransferWithNext {
  transfer: Transfer;
  nextStatuses: string[];
}

// Warehouse-to-warehouse movement (ITRF) — `inventory_transfer` RBAC
// resource, `approve` its own grant. DRFT -> PAPV -> APPV -> TRNS -> RCVD.
// After shipping, stock shows in neither warehouse (genuinely two-legged) —
// GET /in-transit is how that's explained rather than hunted as missing.
const BASE = '/tenant/inventory/transfers';

// `lines` is absent from the payload when the document has none — see withLines.
type TransferWire = Omit<Transfer, 'lines'> & { lines?: TransferLine[] };

function normalize(t: TransferWire): Transfer {
  return withLines<TransferLine, TransferWire>(t);
}

function unwrap(data: { success: boolean; transfer: TransferWire; nextStatuses?: string[] }): TransferWithNext {
  return { transfer: normalize(data.transfer), nextStatuses: data.nextStatuses ?? [] };
}

export const inventoryTransferService = {
  list: (): Promise<TransferPage> =>
    tenantClient
      .get<{ success: boolean; records: TransferWire[]; nextCursor: string; hasMore: boolean }>(BASE)
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  search: (req: TransferSearchRequest): Promise<TransferPage> =>
    tenantClient
      .post<{ success: boolean; records: TransferWire[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: (r.data.records ?? []).map(normalize),
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  // Stock shipped but not yet received at any warehouse — surfaced here so
  // it reads as "on a truck", not as data loss.
  listInTransit: (): Promise<Transfer[]> =>
    tenantClient
      .get<{ success: boolean; records: TransferWire[] }>(`${BASE}/in-transit`)
      .then((r) => (r.data.records ?? []).map(normalize)),

  get: (uuid: string): Promise<TransferWithNext> =>
    tenantClient
      .get<{ success: boolean; transfer: TransferWire; nextStatuses?: string[] }>(`${BASE}/${uuid}`)
      .then((r) => unwrap(r.data)),

  create: (payload: TransferInput): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: TransferWire }>(BASE, payload)
      .then((r) => normalize(r.data.transfer)),

  update: (uuid: string, payload: TransferInput): Promise<Transfer> =>
    tenantClient
      .patch<{ success: boolean; transfer: TransferWire }>(`${BASE}/${uuid}`, payload)
      .then((r) => normalize(r.data.transfer)),

  // A shipped transfer cannot be deleted — the server's message says to
  // receive it and transfer back; show it verbatim rather than paraphrasing.
  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Body key is `status` (not `toStatusCode`) — matches
  // inventory_transfers.go's Transition handler.
  transition: (uuid: string, status: string, note?: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: TransferWire }>(`${BASE}/${uuid}/transition`, { status, note })
      .then((r) => normalize(r.data.transfer)),

  ship: (uuid: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: TransferWire }>(`${BASE}/${uuid}/ship`, {})
      .then((r) => normalize(r.data.transfer)),

  receive: (uuid: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: TransferWire }>(`${BASE}/${uuid}/receive`, {})
      .then((r) => normalize(r.data.transfer)),

  getHistory: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
