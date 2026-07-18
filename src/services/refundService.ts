import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Refund,
  RefundCreatePayload,
  RefundUpdatePayload,
  RefundSearchRequest,
  RefundPage,
} from '@/types/refund';

// Refund API wrapper. Talks to the dedicated relational module under
// `/api/tenant/refunds*` (NOT the generic `/api/tenant/crm/*` JSONB router).
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy, RBAC (`refund:*`), scope, and IDOR.
const BASE = '/tenant/refunds';

export const refundService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchRefunds: (req: RefundSearchRequest): Promise<RefundPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: RefundPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getRefund: (uuid: string): Promise<Refund> =>
    tenantClient
      .get<{ success: boolean; refund: Refund }>(`${BASE}/${uuid}`)
      .then((r) => r.data.refund),

  createRefund: (payload: RefundCreatePayload): Promise<Refund> =>
    tenantClient
      .post<{ success: boolean; refund: Refund }>(BASE, payload)
      .then((r) => r.data.refund),

  updateRefund: (uuid: string, payload: RefundUpdatePayload): Promise<Refund> =>
    tenantClient
      .patch<{ success: boolean; refund: Refund }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.refund),

  deleteRefund: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  // The PEND->APPV move is gated on `refund:approve` server-side, every other
  // move on `refund:transition` (spec AD-4) — see REFUND_TRANSITION_PERMISSION
  // in lib/refundForm.ts for the client-side mirror of that split.
  transition: (uuid: string, toStatusCode: string): Promise<Refund> =>
    tenantClient
      .post<{ success: boolean; refund: Refund }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.refund),

  // Draws part of the refund's unapplied balance from exactly one source —
  // a payment's overpayment or a credit memo's unapplied credit (spec AD-2's
  // XOR). Rejected (400) if amount exceeds min(refund.unappliedAmount,
  // source.available); never silently clamped (AD-6). Also 409 unless the
  // refund is APPV — approving is what authorizes money to leave (AD-5).
  //
  // Callers pass exactly one of paymentUuid/creditMemoUuid; sending both or
  // neither is a 400 (controllers/refund_transition.go's XOR check).
  apply: (
    uuid: string,
    source: { paymentUuid: string } | { creditMemoUuid: string },
    amount: number,
  ): Promise<Refund> =>
    tenantClient
      .post<{ success: boolean; refund: Refund }>(
        `${BASE}/${uuid}/apply`,
        { ...source, amount },
      )
      .then((r) => r.data.refund),

  unapply: (
    uuid: string,
    source: { paymentUuid: string } | { creditMemoUuid: string },
  ): Promise<Refund> =>
    tenantClient
      .post<{ success: boolean; refund: Refund }>(
        `${BASE}/${uuid}/unapply`,
        source,
      )
      .then((r) => r.data.refund),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
