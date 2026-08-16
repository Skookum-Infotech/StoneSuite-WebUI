import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  VendorCredit,
  CreateVendorCreditPayload,
  UpdateVendorCreditPayload,
  VendorCreditSearchRequest,
  VendorCreditPage,
} from '@/types/vendorCredit';

// Vendor Credit API wrapper. Talks to the dedicated relational module under
// `/api/tenant/vendor-credits*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — the accounts-payable mirror of creditMemoService.ts. Every call
// carries the tenant Bearer JWT via `tenantClient`; the server enforces
// tenancy, RBAC (`vendor_credit:*`), scope, and IDOR.
const BASE = '/tenant/vendor-credits';

export const vendorCreditService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchVendorCredits: (req: VendorCreditSearchRequest): Promise<VendorCreditPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: VendorCreditPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getVendorCredit: (uuid: string): Promise<VendorCredit> =>
    tenantClient
      .get<{ success: boolean; vendorCredit: VendorCredit }>(`${BASE}/${uuid}`)
      .then((r) => r.data.vendorCredit),

  createVendorCredit: (payload: CreateVendorCreditPayload): Promise<VendorCredit> =>
    tenantClient
      .post<{ success: boolean; vendorCredit: VendorCredit }>(BASE, payload)
      .then((r) => r.data.vendorCredit),

  // DRFT-only server-side (backend §8, stricter than Vendor Payment's DRFT/PAPV
  // window) — a 400 elsewhere surfaces as a normal save error. Unlike Vendor
  // Payment, `amount` IS accepted here; the vendor is still immutable.
  updateVendorCredit: (uuid: string, payload: UpdateVendorCreditPayload): Promise<VendorCredit> =>
    tenantClient
      .patch<{ success: boolean; vendorCredit: VendorCredit }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.vendorCredit),

  // Blocked (409) while any live application references the credit — reverse
  // it first.
  deleteVendorCredit: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  // DRFT->APPV requires `vendor_credit:approve`; every other move requires
  // `vendor_credit:transition` (backend AD-2) — both cross this one endpoint,
  // unlike Vendor Payment's separate PAPV->APPV `/approve` sign-off.
  transition: (uuid: string, toStatusCode: string): Promise<VendorCredit> =>
    tenantClient
      .post<{ success: boolean; vendorCredit: VendorCredit }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.vendorCredit),

  // Allocates part of the credit's unapplied balance to a vendor bill.
  // Rejected (400) if the amount exceeds min(unappliedAmount, bill.balanceDue),
  // if the bill belongs to another vendor, or if the credit/bill aren't in an
  // appliable/payable status; never silently clamped. Requires
  // `vendor_bill:update` on the target bill in addition to
  // `vendor_credit:update` (backend §6).
  apply: (uuid: string, vendorBillUuid: string, amount: number): Promise<VendorCredit> =>
    tenantClient
      .post<{ success: boolean; vendorCredit: VendorCredit }>(
        `${BASE}/${uuid}/apply`,
        { vendorBillUuid, amount },
      )
      .then((r) => r.data.vendorCredit),

  // Reverses the live application against one bill, restoring both rollups.
  // No status gate on either side — a reversal must always be possible
  // (backend AD-4).
  reverse: (uuid: string, vendorBillUuid: string): Promise<VendorCredit> =>
    tenantClient
      .post<{ success: boolean; vendorCredit: VendorCredit }>(
        `${BASE}/${uuid}/reverse`,
        { vendorBillUuid },
      )
      .then((r) => r.data.vendorCredit),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
