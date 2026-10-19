import { tenantClient } from '@/api/tenantClient';
import type { Bin, BinInput, BinHistoryEntry, BinHistoryPage } from '@/types/inventory';

// Bins — physical locations inside a warehouse, `inventory_bin` RBAC
// resource. Flat with a type and optional parent (max depth 4), not a fixed
// hierarchy; the tree endpoint assembles the navigator view. List and Tree
// are NOT keyset-paginated — they return every live bin at once (a
// warehouse's bin count is small enough that this is the simpler contract).
const BASE = '/tenant/inventory/bins';

export const inventoryBinService = {
  listBins: (warehouseId?: string, includeInactive = false): Promise<Bin[]> =>
    tenantClient
      .get<{ success: boolean; records: Bin[] }>(BASE, {
        params: { ...(warehouseId ? { warehouseId } : {}), ...(includeInactive ? { includeInactive: 'true' } : {}) },
      })
      .then((r) => r.data.records ?? []),

  // path ("YARD-A/AF-03/SLOT-7") is the navigator's breadcrumb; unitCount and
  // overCapacity are advisory only and never block a move.
  getTree: (warehouseId?: string): Promise<Bin[]> =>
    tenantClient
      .get<{ success: boolean; records: Bin[] }>(`${BASE}/tree`, {
        params: warehouseId ? { warehouseId } : undefined,
      })
      .then((r) => r.data.records ?? []),

  getBin: (uuid: string): Promise<Bin> =>
    tenantClient.get<{ success: boolean; bin: Bin }>(`${BASE}/${uuid}`).then((r) => r.data.bin),

  // What has moved into and out of one bin, newest first. Read from the units'
  // own movement history, so it covers every route in and out — bin transfers,
  // WIP moves, cuts, scraps and receipts — not only moves made through one
  // document. Needs inventory_unit:read as well, since it names slab serials.
  // The cursor is opaque: pass back what the server returned.
  getHistory: (
    uuid: string,
    opts: { cursor?: string; direction?: 'in' | 'out'; limit?: number } = {},
  ): Promise<BinHistoryPage> =>
    tenantClient
      .get<{ success: boolean; records?: BinHistoryEntry[]; nextCursor?: string; hasMore?: boolean }>(
        `${BASE}/${uuid}/history`,
        {
          params: {
            ...(opts.cursor ? { cursor: opts.cursor } : {}),
            ...(opts.direction ? { direction: opts.direction } : {}),
            ...(opts.limit ? { limit: opts.limit } : {}),
          },
        },
      )
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  createBin: (payload: BinInput): Promise<Bin> =>
    tenantClient.post<{ success: boolean; bin: Bin }>(BASE, payload).then((r) => r.data.bin),

  updateBin: (uuid: string, payload: BinInput): Promise<Bin> =>
    tenantClient.patch<{ success: boolean; bin: Bin }>(`${BASE}/${uuid}`, payload).then((r) => r.data.bin),

  deleteBin: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),
};
