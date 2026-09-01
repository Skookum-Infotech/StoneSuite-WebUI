import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Expense,
  ExpenseCreatePayload,
  ExpenseUpdatePayload,
  ExpenseSearchRequest,
  ExpensePage,
  ExpenseCategory,
} from '@/types/expense';

// Expense API wrapper. Talks to the dedicated relational module under
// `/api/tenant/expenses*` (NOT the generic `/api/tenant/crm/*` JSONB router)
// — mirrors requisitionService.ts. Every call carries the tenant Bearer JWT
// via `tenantClient`; the server enforces tenancy, RBAC (`expense:*`), scope,
// and IDOR.
const BASE = '/tenant/expenses';

export const expenseService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchExpenses: (req: ExpenseSearchRequest): Promise<ExpensePage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: ExpensePage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getExpense: (uuid: string): Promise<Expense> =>
    tenantClient
      .get<{
        success: boolean; expense: Expense; approval?: {
          gated?: boolean; approvers?: Expense['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.expense,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      }),

  // Claimant is never sent — the server always resolves it from the caller
  // (spec AD-2, self-service; never "file on behalf of").
  createExpense: (payload: ExpenseCreatePayload): Promise<Expense> =>
    tenantClient
      .post<{ success: boolean; expense: Expense }>(BASE, payload)
      .then((r) => r.data.expense),

  // DRFT-only server-side — a 400 elsewhere surfaces as a normal save error.
  updateExpense: (uuid: string, payload: ExpenseUpdatePayload): Promise<Expense> =>
    tenantClient
      .patch<{ success: boolean; expense: Expense }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.expense),

  // DRFT-only server-side.
  deleteExpense: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a
  // failure). RJCT is never a valid target here — rejection always goes
  // through `reject` below.
  transition: (uuid: string, toStatusCode: string): Promise<Expense> =>
    tenantClient
      .post<{ success: boolean; expense: Expense }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.expense),

  // Records one configured approver's sign-off on the claim's current status.
  // Rejected with 409 if the status has no approvers configured, or 403 if
  // the caller isn't one of them.
  approve: (uuid: string): Promise<Expense> =>
    tenantClient
      .post<{ success: boolean; expense: Expense }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.expense),

  // Moves a submitted claim directly to Rejected, always capturing a reason
  // (spec AD-5) — a dedicated decision, never requiring quorum. 403 if
  // approvers are configured for SUBM and the caller isn't one of them.
  reject: (uuid: string, reason: string): Promise<Expense> =>
    tenantClient
      .post<{ success: boolean; expense: Expense }>(`${BASE}/${uuid}/reject`, { reason })
      .then((r) => r.data.expense),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Active lkp_expense_category rows — the line item category picker.
  getCategories: (): Promise<ExpenseCategory[]> =>
    tenantClient
      .get<{ success: boolean; categories: ExpenseCategory[] }>(`${BASE}/categories`)
      .then((r) => r.data.categories ?? []),
};
