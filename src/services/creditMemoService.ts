import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  CreditMemo,
  CreditMemoCreatePayload,
  CreditMemoUpdatePayload,
  CreditMemoSearchRequest,
  CreditMemoPage,
} from '@/types/creditMemo';

// Credit Memo API wrapper. Talks to the dedicated relational module under
// `/api/tenant/credit-memos*` (NOT the generic `/api/tenant/crm/*` JSONB
// router). Every call carries the tenant Bearer JWT via `tenantClient`; the
// server enforces tenancy, RBAC (`credit_memo:*`), scope, and IDOR.
const BASE = '/tenant/credit-memos';

export const creditMemoService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchCreditMemos: (req: CreditMemoSearchRequest): Promise<CreditMemoPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: CreditMemoPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getCreditMemo: (uuid: string): Promise<CreditMemo> =>
    tenantClient
      .get<{
        success: boolean; creditMemo: CreditMemo; approval?: {
          gated?: boolean; approvers?: CreditMemo['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.creditMemo,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      }),

  // Records this caller's sign-off on the credit memo's current gated status
  // (DRFT, AD-8). Rejected with 409 if the status has no approvers
  // configured, or 403 if the caller isn't a configured approver (and isn't
  // a super admin override).
  approve: (uuid: string): Promise<CreditMemo> =>
    tenantClient
      .post<{ success: boolean; creditMemo: CreditMemo }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.creditMemo),

  createCreditMemo: (payload: CreditMemoCreatePayload): Promise<CreditMemo> =>
    tenantClient
      .post<{ success: boolean; creditMemo: CreditMemo }>(BASE, payload)
      .then((r) => r.data.creditMemo),

  updateCreditMemo: (uuid: string, payload: CreditMemoUpdatePayload): Promise<CreditMemo> =>
    tenantClient
      .patch<{ success: boolean; creditMemo: CreditMemo }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.creditMemo),

  // Rejected (409) when the credit memo still has live applications.
  deleteCreditMemo: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  // Note: APPL is not a manually selectable target — it's reached
  // automatically once `apply` fully absorbs the unapplied balance.
  transition: (uuid: string, toStatusCode: string): Promise<CreditMemo> =>
    tenantClient
      .post<{ success: boolean; creditMemo: CreditMemo }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.creditMemo),

  // Applies part of the credit memo's unapplied balance to an invoice.
  // Rejected (400) if amount exceeds min(unappliedAmount, invoice.balanceDue).
  apply: (uuid: string, invoiceUuid: string, amount: number): Promise<CreditMemo> =>
    tenantClient
      .post<{ success: boolean; creditMemo: CreditMemo }>(
        `${BASE}/${uuid}/apply`,
        { invoiceUuid, amount },
      )
      .then((r) => r.data.creditMemo),

  unapply: (uuid: string, invoiceUuid: string): Promise<CreditMemo> =>
    tenantClient
      .post<{ success: boolean; creditMemo: CreditMemo }>(
        `${BASE}/${uuid}/unapply`,
        { invoiceUuid },
      )
      .then((r) => r.data.creditMemo),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
