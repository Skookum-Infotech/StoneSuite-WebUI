import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Payment,
  PaymentCreatePayload,
  PaymentUpdatePayload,
  PaymentSearchRequest,
  PaymentPage,
} from '@/types/payment';

// Payment API wrapper. Talks to the dedicated relational module under
// `/api/tenant/payments*` (NOT the generic `/api/tenant/crm/*` JSONB
// router). Every call carries the tenant Bearer JWT via `tenantClient`; the
// server enforces tenancy, RBAC (`payment:*`), scope, and IDOR.
const BASE = '/tenant/payments';

export const paymentService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchPayments: (req: PaymentSearchRequest): Promise<PaymentPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: PaymentPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getPayment: (uuid: string): Promise<Payment> =>
    tenantClient
      .get<{
        success: boolean; payment: Payment; approval?: {
          gated?: boolean; approvers?: Payment['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.payment,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      }),

  // Records this caller's sign-off on the payment's current gated status
  // (PEND, AD-8). Rejected with 409 if the status has no approvers
  // configured, or 403 if the caller isn't a configured approver (and isn't
  // a super admin override).
  approve: (uuid: string): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.payment),

  createPayment: (payload: PaymentCreatePayload): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(BASE, payload)
      .then((r) => r.data.payment),

  updatePayment: (uuid: string, payload: PaymentUpdatePayload): Promise<Payment> =>
    tenantClient
      .patch<{ success: boolean; payment: Payment }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.payment),

  deletePayment: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.payment),

  // Applies part of the payment's unapplied balance to an invoice. Rejected
  // (400) if amount exceeds min(unappliedAmount, invoice.balanceDue); never
  // silently clamped.
  apply: (uuid: string, invoiceUuid: string, amount: number): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/apply`,
        { invoiceUuid, amount },
      )
      .then((r) => r.data.payment),

  unapply: (uuid: string, invoiceUuid: string): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/unapply`,
        { invoiceUuid },
      )
      .then((r) => r.data.payment),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
