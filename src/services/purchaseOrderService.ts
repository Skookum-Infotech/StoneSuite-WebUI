import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  PurchaseOrderUpdatePayload,
  PurchaseOrderSearchRequest,
  PurchaseOrderPage,
} from '@/types/purchaseOrder';
import type { VendorBill } from '@/types/vendorBill';

// Purchase Order API wrapper. Talks to the dedicated relational module under
// `/api/tenant/purchase-orders*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — mirrors estimateService.ts. Every call carries the tenant Bearer
// JWT via `tenantClient`; the server enforces tenancy, RBAC (`purchase_order:*`),
// scope, and IDOR.
const BASE = '/tenant/purchase-orders';

export const purchaseOrderService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchPurchaseOrders: (req: PurchaseOrderSearchRequest): Promise<PurchaseOrderPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: PurchaseOrderPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getPurchaseOrder: (uuid: string): Promise<PurchaseOrder> =>
    tenantClient
      .get<{
        success: boolean; purchaseOrder: PurchaseOrder; approval?: {
          gated?: boolean; approvers?: PurchaseOrder['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.purchaseOrder,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      }),

  createPurchaseOrder: (payload: PurchaseOrderCreatePayload): Promise<PurchaseOrder> =>
    tenantClient
      .post<{ success: boolean; purchaseOrder: PurchaseOrder }>(BASE, payload)
      .then((r) => r.data.purchaseOrder),

  // DRFT-only server-side — a 400 elsewhere surfaces as a normal save error.
  updatePurchaseOrder: (uuid: string, payload: PurchaseOrderUpdatePayload): Promise<PurchaseOrder> =>
    tenantClient
      .patch<{ success: boolean; purchaseOrder: PurchaseOrder }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.purchaseOrder),

  // DRFT/CANC-only server-side.
  deletePurchaseOrder: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<PurchaseOrder> =>
    tenantClient
      .post<{ success: boolean; purchaseOrder: PurchaseOrder }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.purchaseOrder),

  // Records one configured approver's sign-off on the PO's current status
  // (AD-6). Rejected with 409 if the status has no approvers configured, or
  // 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<PurchaseOrder> =>
    tenantClient
      .post<{ success: boolean; purchaseOrder: PurchaseOrder }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.purchaseOrder),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Creates a Vendor Bill as a snapshot copy of this received purchase order
  // (backend: purchaseorder_convert.go's ConvertToBill). Requires
  // purchase_order:read on the source (IDOR-guarded) and vendor_bill:create
  // on the target. NOT idempotent — a PO may be billed more than once
  // (installment billing), so every call creates a new bill; `created` is
  // always true.
  convertToBill: (uuid: string): Promise<VendorBill> =>
    tenantClient
      .post<{ success: boolean; vendorBill: VendorBill; created: boolean }>(`${BASE}/${uuid}/convert-to-bill`, {})
      .then((r) => r.data.vendorBill),
};
