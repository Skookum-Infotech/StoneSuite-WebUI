import { tenantClient } from '@/api/tenantClient';
import type { Transfer, TransferInput, TransferPage, DocHistoryEntry } from '@/types/inventory';
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

function unwrap(data: { success: boolean; transfer: Transfer; nextStatuses?: string[] }): TransferWithNext {
  return { transfer: data.transfer, nextStatuses: data.nextStatuses ?? [] };
}

export const inventoryTransferService = {
  list: (): Promise<TransferPage> =>
    tenantClient
      .get<{ success: boolean; records: Transfer[]; nextCursor: string; hasMore: boolean }>(BASE)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  search: (req: TransferSearchRequest): Promise<TransferPage> =>
    tenantClient
      .post<{ success: boolean; records: Transfer[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  // Stock shipped but not yet received at any warehouse — surfaced here so
  // it reads as "on a truck", not as data loss.
  listInTransit: (): Promise<Transfer[]> =>
    tenantClient
      .get<{ success: boolean; records: Transfer[] }>(`${BASE}/in-transit`)
      .then((r) => r.data.records ?? []),

  get: (uuid: string): Promise<TransferWithNext> =>
    tenantClient
      .get<{ success: boolean; transfer: Transfer; nextStatuses?: string[] }>(`${BASE}/${uuid}`)
      .then((r) => unwrap(r.data)),

  create: (payload: TransferInput): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: Transfer }>(BASE, payload)
      .then((r) => r.data.transfer),

  update: (uuid: string, payload: TransferInput): Promise<Transfer> =>
    tenantClient
      .patch<{ success: boolean; transfer: Transfer }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.transfer),

  // A shipped transfer cannot be deleted — the server's message says to
  // receive it and transfer back; show it verbatim rather than paraphrasing.
  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Body key is `status` (not `toStatusCode`) — matches
  // inventory_transfers.go's Transition handler.
  transition: (uuid: string, status: string, note?: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: Transfer }>(`${BASE}/${uuid}/transition`, { status, note })
      .then((r) => r.data.transfer),

  ship: (uuid: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: Transfer }>(`${BASE}/${uuid}/ship`, {})
      .then((r) => r.data.transfer),

  receive: (uuid: string): Promise<Transfer> =>
    tenantClient
      .post<{ success: boolean; transfer: Transfer }>(`${BASE}/${uuid}/receive`, {})
      .then((r) => r.data.transfer),

  getHistory: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; history: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.history ?? []),
};
