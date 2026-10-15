import { isAxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type { ApprovalRejection } from '@/types/tenant';
import type { CreatedOrder, CreatedOrderInput } from '@/types/createdOrder';
import { isPortalSession } from '@/store/useAuthStore';
import type { AuditEntry } from '@/services/crmService';
import type {
  SalesOrder,
  SalesOrderCreatePayload,
  SalesOrderUpdatePayload,
  SalesOrderSearchRequest,
  SalesOrderPage,
  SalesOrderInventoryRow,
  SalesOrderScheduleActivity,
  SalesOrderScheduleActivityPatch,
  ScheduleFeed,
  ScheduleFeedEvent,
  ScheduleFeedQuery,
} from '@/types/salesOrder';
import type { Invoice } from '@/types/invoice';

// Sales Order API wrapper. Talks to the dedicated relational module under
// `/api/tenant/sales-orders*` (NOT the generic `/api/tenant/crm/*` JSONB
// router). Every call carries the tenant Bearer JWT via `tenantClient`; the
// server enforces tenancy, RBAC (`sales_order:*`), scope, and IDOR.
const BASE = '/tenant/sales-orders';
// A customer-portal session (see useAuthStore's `kind`) reads through
// /api/portal/sales-orders* instead — same List/Detail pages, different
// endpoint. Only search/get exist there: create/update/delete/transition/
// approve are staff-only, and the backend's RequireAuth confines a portal
// token to /api/portal/* regardless, so there is nothing to branch below.
const PORTAL_BASE = '/portal/sales-orders';

const HTTP_NOT_FOUND = 404;

/** What saving a sales order's customer order form returned. */
export interface CustomerOrderFormSave {
  form: CreatedOrder;
  /** True when the Sales Order was saved along with the form; false when it had
   *  already moved on from Draft and only the form record changed. */
  synced: boolean;
}

export const salesOrderService = {
  // Full filter + sort + global search + keyset pagination (design §11).
  // Cursors are opaque — pass back what the server returned, never construct one.
  searchOrders: (req: SalesOrderSearchRequest): Promise<SalesOrderPage> =>
    tenantClient
      .post<{
        success: boolean; scope?: string; records: SalesOrderPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${isPortalSession() ? PORTAL_BASE : BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getOrder: (uuid: string): Promise<SalesOrder> => {
    if (isPortalSession()) {
      // /api/portal/sales-orders/{uuid} has no approval sub-object — a
      // customer never sees the internal approval workflow, only the
      // finalized document (see portal/visibility.go).
      return tenantClient
        .get<{ success: boolean; record: SalesOrder }>(`${PORTAL_BASE}/${uuid}`)
        .then((r) => ({
          ...r.data.record,
          gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
          canApprove: false, isOverride: false, callerAlreadyApproved: false,
        }));
    }
    return tenantClient
      .get<{
        success: boolean; salesOrder: SalesOrder;
        approval?: {
          gated?: boolean; approvers?: SalesOrder['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean; canReject?: boolean; rejection?: ApprovalRejection;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.salesOrder,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
          canReject: a?.canReject ?? false,
          rejection: a?.rejection,
        };
      });
  },

  createOrder: (payload: SalesOrderCreatePayload): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(BASE, payload)
      .then((r) => r.data.salesOrder),

  updateOrder: (uuid: string, payload: SalesOrderUpdatePayload): Promise<SalesOrder> =>
    tenantClient
      .patch<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.salesOrder),

  deleteOrder: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.salesOrder),

  // Records this user's approval sign-off on the order's current status
  // (AD-10). Rejected with 409 if the status has no approvers configured, or
  // 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.salesOrder),

  // An approver's veto: rejects the sales order while it awaits approval (a reason
  // is required) and sends it back to Draft. Rejected with 403 if the caller isn't a
  // configured approver (and isn't a super admin), 409 if it isn't awaiting
  // approval, 400 without a reason. The POST response has no approval overlay, so
  // callers invalidate the record's query to pick up the rejection banner.
  reject: (uuid: string, reason: string): Promise<SalesOrder> =>
    tenantClient
      .post<{ success: boolean; salesOrder: SalesOrder }>(`${BASE}/${uuid}/reject`, { reason })
      .then((r) => r.data.salesOrder),

  getInventory: (uuid: string): Promise<SalesOrderInventoryRow[]> =>
    tenantClient
      .get<{ success: boolean; items: SalesOrderInventoryRow[] }>(`${BASE}/${uuid}/inventory`)
      .then((r) => r.data.items ?? []),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // The countertop order form this order was drafted from (tenant side; a
  // portal session has no such route). null when the order was not placed from
  // the portal — the server's 404 there is an answer, not a failure.
  getCustomerOrderForm: (uuid: string): Promise<CreatedOrder | null> =>
    tenantClient
      .get<{ success: boolean; form: CreatedOrder }>(`${BASE}/${uuid}/customer-order-form`)
      .then((r) => r.data.form)
      .catch((err: unknown) => {
        if (isAxiosError(err) && err.response?.status === HTTP_NOT_FOUND) return null;
        throw err;
      }),

  // Super admin only (403 otherwise). The whole form is sent, as the customer
  // sends it. The order's lines follow only while it is still a Draft.
  updateCustomerOrderForm: (uuid: string, input: CreatedOrderInput): Promise<CustomerOrderFormSave> =>
    tenantClient
      .put<{ success: boolean; form: CreatedOrder; synced: boolean }>(
        `${BASE}/${uuid}/customer-order-form`,
        input,
      )
      .then((r) => ({ form: r.data.form, synced: Boolean(r.data.synced) })),

  // The Activity Planner's feed: every planned activity of one group across the
  // orders this caller can read, for an inclusive date window (at most ~3
  // months). Scope-filtered by the server like the order list; cancelled
  // orders are left out.
  getScheduleFeed: ({ group, from, to }: ScheduleFeedQuery): Promise<ScheduleFeed> =>
    tenantClient
      .get<{ success: boolean; events: ScheduleFeedEvent[]; truncated?: boolean }>(
        `${BASE}/schedule`,
        { params: { group, from, to } },
      )
      .then((r) => ({ events: r.data.events ?? [], truncated: Boolean(r.data.truncated) })),

  // The order's auto-planned production schedule, in plan order. Empty until a
  // scheduled installation date has been saved on the order.
  getSchedule: (uuid: string): Promise<SalesOrderScheduleActivity[]> =>
    tenantClient
      .get<{ success: boolean; activities: SalesOrderScheduleActivity[] }>(`${BASE}/${uuid}/schedule`)
      .then((r) => r.data.activities ?? []),

  // Partial edit of one activity (status / scheduled time / completed-on / notes).
  // Gated on sales_order:update, like editing the order itself.
  updateScheduleActivity: (
    uuid: string,
    code: string,
    patch: SalesOrderScheduleActivityPatch,
  ): Promise<SalesOrderScheduleActivity> =>
    tenantClient
      .patch<{ success: boolean; activity: SalesOrderScheduleActivity }>(
        `${BASE}/${uuid}/schedule/${encodeURIComponent(code)}`,
        patch,
      )
      .then((r) => r.data.activity),

  // Snapshot-copies this order into a new Invoice (idempotent — replaying
  // against an already-converted order returns the existing Invoice with
  // created: false rather than erroring).
  convertToInvoice: (uuid: string): Promise<{ invoice: Invoice; created: boolean }> =>
    tenantClient
      .post<{ success: boolean; invoice: Invoice; created: boolean }>(`${BASE}/${uuid}/convert`, {})
      .then((r) => ({ invoice: r.data.invoice, created: r.data.created })),
};
