import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type {
  Requisition,
  RequisitionCreatePayload,
  RequisitionUpdatePayload,
  RequisitionSearchRequest,
  RequisitionPage,
  RequisitionConvertResult,
} from '@/types/requisition';

// Requisition API wrapper. Talks to the dedicated relational module under
// `/api/tenant/requisitions*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — mirrors purchaseOrderService.ts. Every call carries the tenant
// Bearer JWT via `tenantClient`; the server enforces tenancy, RBAC
// (`requisition:*`), scope, and IDOR.
const BASE = '/tenant/requisitions';

export const requisitionService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchRequisitions: (req: RequisitionSearchRequest): Promise<RequisitionPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: RequisitionPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getRequisition: (uuid: string): Promise<Requisition> =>
    tenantClient
      .get<{
        success: boolean; requisition: Requisition; approval?: {
          gated?: boolean; approvers?: Requisition['approvers']; requiredApprovals?: number; approvedCount?: number;
          canApprove?: boolean; isOverride?: boolean; callerAlreadyApproved?: boolean;
        };
      }>(`${BASE}/${uuid}`)
      .then((r) => {
        const a = r.data.approval;
        return {
          ...r.data.requisition,
          gated: a?.gated ?? false,
          approvers: a?.approvers ?? [],
          requiredApprovals: a?.requiredApprovals ?? 0,
          approvedCount: a?.approvedCount ?? 0,
          canApprove: a?.canApprove ?? false,
          isOverride: a?.isOverride ?? false,
          callerAlreadyApproved: a?.callerAlreadyApproved ?? false,
        };
      }),

  createRequisition: (payload: RequisitionCreatePayload): Promise<Requisition> =>
    tenantClient
      .post<{ success: boolean; requisition: Requisition }>(BASE, payload)
      .then((r) => r.data.requisition),

  // DRFT-only server-side — a 400 elsewhere surfaces as a normal save error.
  updateRequisition: (uuid: string, payload: RequisitionUpdatePayload): Promise<Requisition> =>
    tenantClient
      .patch<{ success: boolean; requisition: Requisition }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.requisition),

  // DRFT/CANC-only server-side.
  deleteRequisition: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Requisition> =>
    tenantClient
      .post<{ success: boolean; requisition: Requisition }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.requisition),

  // Records one configured approver's sign-off on the requisition's current
  // status. Rejected with 409 if the status has no approvers configured, or
  // 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<Requisition> =>
    tenantClient
      .post<{ success: boolean; requisition: Requisition }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.requisition),

  // Converts an APPV requisition into a draft Purchase Order. `vendorUuid` is
  // required — a requisition's own vendor is only ever a suggestion, so the
  // caller must decide the purchase order's real, mandatory vendor. The call
  // is idempotent: replaying it against an already-converted requisition
  // returns the existing purchase order with `created: false` rather than
  // making a duplicate, so callers should treat that as success.
  convert: (uuid: string, vendorUuid: string): Promise<RequisitionConvertResult> =>
    tenantClient
      .post<{ success: boolean; purchaseOrder: PurchaseOrder; created: boolean }>(
        `${BASE}/${uuid}/convert`,
        { vendorUuid },
      )
      .then((r) => ({
        purchaseOrderId: r.data.purchaseOrder.id,
        purchaseOrderNumber: r.data.purchaseOrder.purchaseOrderNumber,
        created: Boolean(r.data.created),
      })),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
