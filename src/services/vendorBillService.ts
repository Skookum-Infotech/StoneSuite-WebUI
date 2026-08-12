import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  VendorBill,
  CreateVendorBillPayload,
  UpdateVendorBillPayload,
  VendorBillSearchRequest,
  VendorBillPage,
  VendorBillPaymentLedger,
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

  // AP reconciliation view: every live vendor payment application and refund
  // against this bill. Read-only by design — a bill no longer owns a
  // settlement ledger, so recording or reversing money happens on the Vendor
  // Payment side (`vendorPaymentService.apply` / `.unapply`), which recomputes
  // this bill's amount_paid/balance_due as a side effect.
  getPayments: (uuid: string): Promise<VendorBillPaymentLedger> =>
    tenantClient
      .get<{
        success: boolean; recordId: string;
        payments: VendorBillPaymentLedger['payments'];
        refunds: VendorBillPaymentLedger['refunds'];
      }>(`${BASE}/${uuid}/payments`)
      .then((r) => ({ payments: r.data.payments ?? [], refunds: r.data.refunds ?? [] })),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
