import { tenantClient } from '@/api/tenantClient';
import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';

// The slabs a sales order's Material drawing lays pieces on. Adding a slab to the
// drawing reserves it for the order; removing it gives it back. Follows the sales
// order's own RBAC (read to list, update to add or remove), so a salesperson needs
// no inventory rights.
const base = (salesOrderId: string) => `/tenant/sales-orders/${salesOrderId}/drawing`;

export const drawingSlabService = {
  /** The order's slab-tracked items, each with the slabs the drawing can use. */
  listOptions: (salesOrderId: string): Promise<DrawingSlabItem[]> =>
    tenantClient
      .get<{ success: boolean; items: DrawingSlabItem[] }>(`${base(salesOrderId)}/slab-options`)
      .then((r) => r.data.items ?? []),

  /** Hold one slab for the order. Adding a slab the order already holds is a no-op. */
  hold: (salesOrderId: string, slabId: string): Promise<DrawingSlabUnit> =>
    tenantClient
      .post<{ success: boolean; unit: DrawingSlabUnit }>(`${base(salesOrderId)}/slabs`, { slabId })
      .then((r) => r.data.unit),

  /** Give a held slab back to inventory. */
  release: (salesOrderId: string, slabId: string): Promise<void> =>
    tenantClient.delete(`${base(salesOrderId)}/slabs/${slabId}`).then(() => undefined),
};
