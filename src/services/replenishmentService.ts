import { tenantClient } from '@/api/tenantClient';
import type { DraftedOrder, DraftInput, ReorderList } from '@/types/replenishment';

// The Reorder page — GET /api/tenant/replenishment and
// POST /api/tenant/replenishment/draft. The server has no per-row owner to
// scope a row by, so a caller needs replenishment access at "all" scope; a
// narrower grant is a plain 403.

export const replenishmentService = {
  /** The items that will run short next month. Worked out fresh on every call. */
  list: (): Promise<ReorderList> =>
    tenantClient
      .get<{ success: boolean; months: string[] | null; items: ReorderList['items'] | null }>('/tenant/replenishment')
      .then((r) => ({ months: r.data.months ?? [], items: r.data.items ?? [] })),

  /** Creates one draft purchase order per vendor for a single item, all or
   *  none. 404 = the item can't be reordered; 400 = a vendor or quantity the
   *  server refused (the message says which). */
  draft: (input: DraftInput): Promise<DraftedOrder[]> =>
    tenantClient
      .post<{ success: boolean; purchaseOrders: DraftedOrder[] }>('/tenant/replenishment/draft', input)
      .then((r) => r.data.purchaseOrders),
};
