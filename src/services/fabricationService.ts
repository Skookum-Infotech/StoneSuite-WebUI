import { tenantClient } from '@/api/tenantClient';
import type {
  FabricationJob,
  FabricationJobCreatePayload,
  FabricationJobUpdatePayload,
  FabricationJobSearchRequest,
  FabricationJobPage,
  FabricationJobStep,
  FabricationSlab,
  CreateSlabInput,
  SlabDispositionInput,
} from '@/types/fabrication';

// Fabrication & Installation API wrapper. Talks to the dedicated relational
// module under `/api/tenant/fabrication-jobs*` and the serialized slab
// catalog under `/api/tenant/inventory/slabs*` — NOT the generic
// `/api/tenant/crm/*` JSONB router. Every call carries the tenant Bearer JWT
// via `tenantClient`; the server enforces tenancy, RBAC (`installation:*`,
// plus `inventory_item:*` on slab routes), scope, and IDOR.
//
// There is no `/fabrication-jobs/{uuid}/audit` route registered server-side
// (unlike Sales Order/Quote/Invoice) — no audit tab/method until that lands.
// There is also no slab list/search endpoint — only GET by uuid — so
// allocating a slab from the UI takes a pasted slab uuid, not a picker.
const BASE = '/tenant/fabrication-jobs';
const SLAB_BASE = '/tenant/inventory/slabs';

export const fabricationService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchJobs: (req: FabricationJobSearchRequest): Promise<FabricationJobPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: FabricationJobPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getJob: (uuid: string): Promise<FabricationJob> =>
    tenantClient
      .get<{ success: boolean; fabricationJob: FabricationJob }>(`${BASE}/${uuid}`)
      .then((r) => r.data.fabricationJob),

  // A job always originates from a sales order — this create path takes an
  // explicit salesOrderUuid in the payload (used by the standalone Add page).
  createJob: (payload: FabricationJobCreatePayload): Promise<FabricationJob> =>
    tenantClient
      .post<{ success: boolean; fabricationJob: FabricationJob }>(BASE, payload)
      .then((r) => r.data.fabricationJob),

  // Spawn a job directly from a Sales Order's own "Create Fabrication Job"
  // action (POST /sales-orders/{uuid}/fabricate) — the path segment fixes
  // the sales order, so the body needs no salesOrderUuid.
  fabricateFromOrder: (salesOrderUuid: string, fields?: Partial<FabricationJobUpdatePayload>): Promise<FabricationJob> =>
    tenantClient
      .post<{ success: boolean; fabricationJob: FabricationJob }>(
        `/tenant/sales-orders/${salesOrderUuid}/fabricate`,
        fields ?? {},
      )
      .then((r) => r.data.fabricationJob),

  updateJob: (uuid: string, payload: FabricationJobUpdatePayload): Promise<FabricationJob> =>
    tenantClient
      .patch<{ success: boolean; fabricationJob: FabricationJob }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.fabricationJob),

  // Draft/cancelled jobs only — a job with live slab reservations must be
  // cancelled first (409 otherwise), surfaced as a normal delete error.
  deleteJob: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message). Cancelling
  // is routed through this same endpoint server-side, but the UI always uses
  // requestCancel below so the disposition flow can react to the 409.
  transition: (uuid: string, toStatusCode: string): Promise<FabricationJob> =>
    tenantClient
      .put<{ success: boolean; fabricationJob: FabricationJob }>(
        `${BASE}/${uuid}/fabrication/status`,
        { toStatusCode },
      )
      .then((r) => r.data.fabricationJob),

  // Cancel is just a transition to CANC, but kept as its own method so
  // call sites read as "cancel", not "transition to a magic code". A 409
  // here (ErrDispositionRequired) means every consumed slab needs a
  // disposition first — see recordDisposition.
  requestCancel: (uuid: string): Promise<FabricationJob> =>
    fabricationService.transition(uuid, 'CANC'),

  hold: (uuid: string): Promise<FabricationJob> =>
    tenantClient
      .post<{ success: boolean; fabricationJob: FabricationJob }>(`${BASE}/${uuid}/hold`, {})
      .then((r) => r.data.fabricationJob),

  // Resume takes no body by design — the target status is stored server-side
  // (job_held_from_status_id), never caller-supplied.
  resume: (uuid: string): Promise<FabricationJob> =>
    tenantClient
      .post<{ success: boolean; fabricationJob: FabricationJob }>(`${BASE}/${uuid}/resume`, {})
      .then((r) => r.data.fabricationJob),

  // Records this caller's sign-off at the job's current status (TAPV/QCPS
  // gates, or wherever an admin has configured approvers). A 409
  // (ErrApprovalNotRequired) means the current status has no configured
  // approvers — the button should already be hidden via approvalStatus.
  approve: (uuid: string): Promise<FabricationJob> =>
    tenantClient
      .post<{ success: boolean; fabricationJob: FabricationJob }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.fabricationJob),

  getSteps: (uuid: string): Promise<FabricationJobStep[]> =>
    tenantClient
      .get<{ success: boolean; steps: FabricationJobStep[] }>(`${BASE}/${uuid}/steps`)
      .then((r) => r.data.steps ?? []),

  // Updates every step row sharing this code (piece-grain steps have one row
  // per piece, all patched together — there is no per-piece target yet).
  updateStep: (
    uuid: string,
    stepCode: string,
    body: { status: string; notes?: string; payload?: Record<string, unknown> },
  ): Promise<FabricationJobStep> =>
    tenantClient
      .patch<{ success: boolean; step: FabricationJobStep }>(`${BASE}/${uuid}/steps/${stepCode}`, body)
      .then((r) => r.data.step),

  // Allocated slabs (any allocation status). Needs installation:read AND
  // inventory_item:read server-side — gate the Slabs tab on both grants.
  getJobSlabs: (uuid: string): Promise<FabricationSlab[]> =>
    tenantClient
      .get<{ success: boolean; slabs: FabricationSlab[] }>(`${BASE}/${uuid}/slabs`)
      .then((r) => r.data.slabs ?? []),

  // Reserves an existing slab (by uuid) against the job. Legal from MALC
  // onward, including after CUTG (replacing a broken slab on a live job).
  allocateSlab: (uuid: string, slabUuid: string, pieceUuid?: string): Promise<void> =>
    tenantClient
      .post<{ success: boolean }>(`${BASE}/${uuid}/slabs`, { slabUuid, pieceUuid: pieceUuid || undefined })
      .then(() => undefined),

  // Releases a still-reserved slab. A consumed slab can't be deallocated —
  // record a disposition instead (only legal once cancel is in progress).
  deallocateSlab: (uuid: string, slabUuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}/slabs/${slabUuid}`).then(() => undefined),

  // Declares the fate of one consumed slab on a cancel-requested job.
  // Write-once per slab; a 400 here (e.g. recovered area out of range) is a
  // field-level error, not a general failure.
  recordDisposition: (uuid: string, slabUuid: string, input: SlabDispositionInput): Promise<void> =>
    tenantClient
      .post<{ success: boolean }>(`${BASE}/${uuid}/slabs/${slabUuid}/disposition`, input)
      .then(() => undefined),
};

export const inventorySlabService = {
  getSlab: (uuid: string): Promise<FabricationSlab> =>
    tenantClient
      .get<{ success: boolean; slab: FabricationSlab }>(`${SLAB_BASE}/${uuid}`)
      .then((r) => r.data.slab),

  // Receives a full physical slab — offcuts are minted internally by
  // recovery, never through this path.
  createSlab: (input: CreateSlabInput): Promise<FabricationSlab> =>
    tenantClient
      .post<{ success: boolean; slab: FabricationSlab }>(SLAB_BASE, input)
      .then((r) => r.data.slab),

  scrapSlab: (uuid: string): Promise<void> =>
    tenantClient.post(`${SLAB_BASE}/${uuid}/scrap`, {}).then(() => undefined),
};
