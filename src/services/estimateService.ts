import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Estimate,
  EstimateCreatePayload,
  EstimateUpdatePayload,
  EstimateSearchRequest,
  EstimatePage,
} from '@/types/estimate';
import type { Quote } from '@/types/quote';

// Estimate API wrapper. Talks to the dedicated relational module under
// `/api/tenant/estimates*` (NOT the generic `/api/tenant/crm/*` JSONB router).
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy, RBAC (`estimate:*`), scope, and IDOR.
const BASE = '/tenant/estimates';

export const estimateService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchEstimates: (req: EstimateSearchRequest): Promise<EstimatePage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: EstimatePage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getEstimate: (uuid: string): Promise<Estimate> =>
    tenantClient
      .get<{ success: boolean; estimate: Estimate; approvers?: Estimate['approvers']; canApprove?: boolean }>(`${BASE}/${uuid}`)
      .then((r) => ({ ...r.data.estimate, approvers: r.data.approvers ?? [], canApprove: r.data.canApprove ?? false })),

  createEstimate: (payload: EstimateCreatePayload): Promise<Estimate> =>
    tenantClient
      .post<{ success: boolean; estimate: Estimate }>(BASE, payload)
      .then((r) => r.data.estimate),

  updateEstimate: (uuid: string, payload: EstimateUpdatePayload): Promise<Estimate> =>
    tenantClient
      .patch<{ success: boolean; estimate: Estimate }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.estimate),

  deleteEstimate: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Estimate> =>
    tenantClient
      .post<{ success: boolean; estimate: Estimate }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.estimate),

  // Records one configured approver's sign-off on the estimate's current
  // status (AD-8). Rejected with 409 if the status has no approvers
  // configured, or 403 if the caller isn't one of them.
  approve: (uuid: string): Promise<Estimate> =>
    tenantClient
      .post<{ success: boolean; estimate: Estimate }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.estimate),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Snapshot-copies this estimate into a new Quote (idempotent — replaying
  // against an already-converted estimate returns the existing Quote with
  // created: false rather than erroring).
  convertToQuote: (uuid: string): Promise<{ quote: Quote; created: boolean }> =>
    tenantClient
      .post<{ success: boolean; quote: Quote; created: boolean }>(`${BASE}/${uuid}/convert`, {})
      .then((r) => ({ quote: r.data.quote, created: r.data.created })),
};
