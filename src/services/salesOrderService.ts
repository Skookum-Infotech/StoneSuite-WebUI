import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  SalesOrder,
  SalesOrderCreatePayload,
  SalesOrderUpdatePayload,
  SalesOrderSearchRequest,
  SalesOrderPage,
  SalesOrderInventoryRow,
} from '@/types/salesOrder';

// Sales Order API wrapper. Talks to the dedicated relational module under
// `/api/tenant/sales-orders*` (NOT the generic `/api/tenant/crm/*` JSONB
// router). Every call carries the tenant Bearer JWT via `tenantClient`; the
// server enforces tenancy, RBAC (`sales_order:*`), scope, and IDOR.
const BASE = '/tenant/sales-orders';

export const salesOrderService = {
  // Full filter + sort + global search + keyset pagination (design §11).
  // Cursors are opaque — pass back what the server returned, never construct one.
  searchOrders: (req: SalesOrderSearchRequest): Promise<SalesOrderPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: SalesOrderPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getOrder: (uuid: string): Promise<SalesOrder> =>
    tenantClient
      .get<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}`)
      .then((r) => r.data.salesOrder),

  createOrder: (payload: SalesOrderCreatePayload): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(BASE, payload)
      .then((r) => r.data.salesOrder),

  updateOrder: (uuid: string, payload: SalesOrderUpdatePayload): Promise<SalesOrder> =>
    tenantClient
      .patch<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.salesOrder),

  deleteOrder: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.salesOrder),

  getInventory: (uuid: string): Promise<SalesOrderInventoryRow[]> =>
    tenantClient
      .get<{ success: boolean; items: SalesOrderInventoryRow[] }>(`${BASE}/${uuid}/inventory`)
      .then((r) => r.data.items ?? []),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
