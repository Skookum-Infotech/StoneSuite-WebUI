import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  VendorPayment,
  CreateVendorPaymentPayload,
  UpdateVendorPaymentPayload,
  VendorPaymentSearchRequest,
  VendorPaymentPage,
} from '@/types/vendorPayment';

// Vendor Payment API wrapper. Talks to the dedicated relational module under
// `/api/tenant/vendor-payments*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — the accounts-payable mirror of paymentService.ts. Every call
// carries the tenant Bearer JWT via `tenantClient`; the server enforces
// tenancy, RBAC (`vendor_payment:*`), scope, and IDOR.
//
// Refunds (backend AD-5) are deliberately absent: vendorpayment.RecordRefund/
// RemoveRefund exist in the store but no controller or route exposes them yet,
// so a payment's refunds are read-only, arriving on the GET response.
const BASE = '/tenant/vendor-payments';

export const vendorPaymentService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchVendorPayments: (req: VendorPaymentSearchRequest): Promise<VendorPaymentPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: VendorPaymentPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getVendorPayment: (uuid: string): Promise<VendorPayment> =>
    tenantClient
      .get<{ success: boolean; vendorPayment: VendorPayment }>(`${BASE}/${uuid}`)
      .then((r) => r.data.vendorPayment),

  // Inline `applications` are applied AFTER the header commits, each in its own
  // transaction — a failure there leaves the header saved with a partial
  // ledger, so callers must surface the error rather than assume a rollback.
  createVendorPayment: (payload: CreateVendorPaymentPayload): Promise<VendorPayment> =>
    tenantClient
      .post<{ success: boolean; vendorPayment: VendorPayment }>(BASE, payload)
      .then((r) => r.data.vendorPayment),

  // DRFT/PAPV-only server-side — a 400 elsewhere surfaces as a normal save
  // error. Amount and vendor are immutable post-creation.
  updateVendorPayment: (uuid: string, payload: UpdateVendorPaymentPayload): Promise<VendorPayment> =>
    tenantClient
      .patch<{ success: boolean; vendorPayment: VendorPayment }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.vendorPayment),

  // Blocked (409) while any live application references the payment — unapply
  // or void it first.
  deleteVendorPayment: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  // PAPV→APPV is deliberately rejected here — that edge is reachable only
  // through `approve` below.
  transition: (uuid: string, toStatusCode: string): Promise<VendorPayment> =>
    tenantClient
      .post<{ success: boolean; vendorPayment: VendorPayment }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.vendorPayment),

  // Records one configured approver's sign-off at the payment's current status
  // (AD-6). 409 if the status has no approvers configured, 403 if the caller
  // isn't one of them. Once the last required sign-off lands while the payment
  // sits at PAPV, this also advances it to APPV in the same transaction.
  approve: (uuid: string): Promise<VendorPayment> =>
    tenantClient
      .post<{ success: boolean; vendorPayment: VendorPayment }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.vendorPayment),

  // Allocates part of the payment's unapplied balance to a vendor bill.
  // Rejected (400) if the amount exceeds min(unappliedAmount, bill.balanceDue),
  // if the bill belongs to another vendor, or if the bill isn't approved yet;
  // never silently clamped. Requires `vendor_bill:update` on the target bill in
  // addition to `vendor_payment:update` (AD-10).
  apply: (uuid: string, vendorBillUuid: string, amount: number): Promise<VendorPayment> =>
    tenantClient
      .post<{ success: boolean; vendorPayment: VendorPayment }>(
        `${BASE}/${uuid}/apply`,
        { vendorBillUuid, amount },
      )
      .then((r) => r.data.vendorPayment),

  // Reverses the live application against one bill. No status gate on either
  // side — a reversal must always be possible.
  unapply: (uuid: string, vendorBillUuid: string): Promise<VendorPayment> =>
    tenantClient
      .post<{ success: boolean; vendorPayment: VendorPayment }>(
        `${BASE}/${uuid}/unapply`,
        { vendorBillUuid },
      )
      .then((r) => r.data.vendorPayment),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
