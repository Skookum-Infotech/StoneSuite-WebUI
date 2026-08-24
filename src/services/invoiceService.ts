import { tenantClient } from '@/api/tenantClient';
import { isPortalSession } from '@/store/useAuthStore';
import type { AuditEntry } from '@/services/crmService';
import type {
  Invoice,
  InvoiceCreatePayload,
  InvoiceUpdatePayload,
  InvoiceSearchRequest,
  InvoicePage,
} from '@/types/invoice';

// Invoice API wrapper. Talks to the dedicated relational module under
// `/api/tenant/invoices*` (NOT the generic `/api/tenant/crm/*` JSONB router).
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy, RBAC (`invoice:*`), scope, and IDOR.
const BASE = '/tenant/invoices';
// A customer-portal session (see useAuthStore's `kind`) reads through
// /api/portal/invoices* instead — same List/Detail pages, different
// endpoint. Only search/get exist there: create/update/delete/transition/
// approve are staff-only, and the backend's RequireAuth confines a portal
// token to /api/portal/* regardless, so there is nothing to branch below.
const PORTAL_BASE = '/portal/invoices';

export const invoiceService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchInvoices: (req: InvoiceSearchRequest): Promise<InvoicePage> =>
    tenantClient
      .post<{
        success: boolean; scope?: string; records: InvoicePage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${isPortalSession() ? PORTAL_BASE : BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getInvoice: (uuid: string): Promise<Invoice> => {
    if (isPortalSession()) {
      // /api/portal/invoices/{uuid} has no approval sub-object — a customer
      // never sees the internal approval workflow, only the finalized
      // document (see portal/visibility.go).
      return tenantClient
        .get<{ success: boolean; record: Invoice }>(`${PORTAL_BASE}/${uuid}`)
        .then((r) => ({
          ...r.data.record,
          gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
          canApprove: false, isOverride: false, callerAlreadyApproved: false,
        }));
    }
    return tenantClient
      .get<{
        success: boolean; invoice: Invoice; approval?: {
          gated?: boolean; approvers?: Invoice['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.invoice,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      });
  },

  // Records this caller's sign-off on the invoice's current gated status
  // (PAPV, AD-8). Rejected with 409 if the status has no approvers
  // configured, or 403 if the caller isn't a configured approver (and isn't
  // a super admin override).
  approve: (uuid: string): Promise<Invoice> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.invoice),

  createInvoice: (payload: InvoiceCreatePayload): Promise<Invoice> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice }>(BASE, payload)
      .then((r) => r.data.invoice),

  updateInvoice: (uuid: string, payload: InvoiceUpdatePayload): Promise<Invoice> =>
    tenantClient
      .patch<{ success: boolean; invoice: Invoice }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.invoice),

  deleteInvoice: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Invoice> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.invoice),

  // Only accepts a positive `amount` — the backend has no date/method fields
  // for a recorded payment (spec §12). Rejected with 409 unless the invoice
  // is currently SENT/PART/ODUE, and rejected if it would overpay.
  recordPayment: (uuid: string, amount: number): Promise<Invoice> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice }>(
        `${BASE}/${uuid}/payment`,
        { amount },
      )
      .then((r) => r.data.invoice),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
