import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  VendorBill,
  CreateVendorBillPayload,
  UpdateVendorBillPayload,
  VendorBillSearchRequest,
  VendorBillPage,
  VendorBillPayment,
  RecordVendorBillPaymentPayload,
} from '@/types/vendorBill';

// Vendor Bill API wrapper. Talks to the dedicated relational module under
// `/api/tenant/vendor-bills*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — mirrors purchaseOrderService.ts. Every call carries the tenant
// Bearer JWT via `tenantClient`; the server enforces tenancy, RBAC
// (`vendor_bill:*`), scope, and IDOR.
const BASE = '/tenant/vendor-bills';

export const vendorBillService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchVendorBills: (req: VendorBillSearchRequest): Promise<VendorBillPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: VendorBillPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getVendorBill: (uuid: string): Promise<VendorBill> =>
    tenantClient
      .get<{ success: boolean; vendorBill: VendorBill }>(`${BASE}/${uuid}`)
      .then((r) => r.data.vendorBill),

  createVendorBill: (payload: CreateVendorBillPayload): Promise<VendorBill> =>
    tenantClient
      .post<{ success: boolean; vendorBill: VendorBill }>(BASE, payload)
      .then((r) => r.data.vendorBill),

  // DRFT-only server-side — a 400 elsewhere surfaces as a normal save error.
  updateVendorBill: (uuid: string, payload: UpdateVendorBillPayload): Promise<VendorBill> =>
    tenantClient
      .patch<{ success: boolean; vendorBill: VendorBill }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.vendorBill),

  // DRFT/VOID-only server-side.
  deleteVendorBill: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<VendorBill> =>
    tenantClient
      .post<{ success: boolean; vendorBill: VendorBill }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.vendorBill),

  // Records one configured approver's sign-off on the bill's current status
  // (AD-6). Rejected with 409 if the status has no approvers configured, or
  // 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<VendorBill> =>
    tenantClient
      .post<{ success: boolean; vendorBill: VendorBill }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.vendorBill),

  // Records a settlement against the bill (AD-7); recomputes amount_paid/
  // balance_due and re-derives status. Only accepted on APPV/PART/ODUE — a
  // 409 elsewhere, a 400 on overpayment (rejected, never clamped).
  recordPayment: (uuid: string, payload: RecordVendorBillPaymentPayload): Promise<VendorBill> =>
    tenantClient
      .post<{ success: boolean; vendorBill: VendorBill }>(`${BASE}/${uuid}/payment`, payload)
      .then((r) => r.data.vendorBill),

  getPayments: (uuid: string): Promise<VendorBillPayment[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; payments: VendorBillPayment[] }>(`${BASE}/${uuid}/payments`)
      .then((r) => r.data.payments ?? []),

  // Soft-deletes one ledger entry (the "unapply") and recomputes the AP
  // rollup.
  removePayment: (uuid: string, paymentId: string): Promise<VendorBill> =>
    tenantClient
      .delete<{ success: boolean; vendorBill: VendorBill }>(`${BASE}/${uuid}/payments/${paymentId}`)
      .then((r) => r.data.vendorBill),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
