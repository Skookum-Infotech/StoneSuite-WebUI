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
import type { Invoice } from '@/types/invoice';

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
      .get<{
        success: boolean; salesOrder: SalesOrder; gated?: boolean;
        approvers?: SalesOrder['approvers']; canApprove?: boolean; isOverride?: boolean;
      }>(`${BASE}/${uuid}`)
      .then((r) => ({
        ...r.data.salesOrder,
        gated: r.data.gated ?? false,
        approvers: r.data.approvers ?? [],
        canApprove: r.data.canApprove ?? false,
        isOverride: r.data.isOverride ?? false,
      })),

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

  // Records this user's approval sign-off on the order's current status
  // (AD-10). Rejected with 409 if the status has no approvers configured, or
  // 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.salesOrder),

  getInventory: (uuid: string): Promise<SalesOrderInventoryRow[]> =>
    tenantClient
      .get<{ success: boolean; items: SalesOrderInventoryRow[] }>(`${BASE}/${uuid}/inventory`)
      .then((r) => r.data.items ?? []),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Snapshot-copies this order into a new Invoice (idempotent — replaying
  // against an already-converted order returns the existing Invoice with
  // created: false rather than erroring).
  convertToInvoice: (uuid: string): Promise<{ invoice: Invoice; created: boolean }> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice; created: boolean }>(`${BASE}/${uuid}/convert`, {})
      .then((r) => ({ invoice: r.data.invoice, created: r.data.created })),
};
