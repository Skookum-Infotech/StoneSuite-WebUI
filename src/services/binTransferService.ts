import { tenantClient } from '@/api/tenantClient';
import type { ApprovalOverlay } from '@/types/tenant';
import type { DocHistoryEntry } from '@/types/inventory';
import type {
  BinTransfer, BinTransferRecord, BinTransferInput, BinTransferPage, BinTransferSearchRequest,
} from '@/types/binTransfer';

// Bin Transfer API wrapper — `bin_transfer` RBAC resource, with `approve` its
// own grant. A dedicated relational module under `/api/tenant/inventory/
// bin-transfers*`; every call carries the tenant Bearer JWT via `tenantClient`
// and the server enforces tenancy, RBAC, scope and IDOR.
//
// Statuses DRFT -> PAPV -> APPV -> COMP, or CANC before the stone is moved.
// Approval is the Configure > Workflows approver chain; `complete` is the only
// call that moves a slab.
const BASE = '/tenant/inventory/bin-transfers';

type ApprovalWire = Partial<ApprovalOverlay>;

function withApproval(record: BinTransferRecord, a: ApprovalWire | undefined): BinTransfer {
  return {
    ...record,
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
}

export const binTransferService = {
  // Full filter + sort + global search + keyset pagination. Cursors are opaque:
  // pass back what the server returned, never construct one.
  search: (req: BinTransferSearchRequest): Promise<BinTransferPage> =>
    tenantClient
      .post<{
        success: boolean; scope?: string; records?: BinTransferRecord[]; nextCursor?: string; hasMore?: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  get: (uuid: string): Promise<BinTransfer> =>
    tenantClient
      .get<{ success: boolean; binTransfer: BinTransferRecord; approval?: ApprovalWire }>(`${BASE}/${uuid}`)
      .then((r) => withApproval(r.data.binTransfer, r.data.approval)),

  create: (input: BinTransferInput): Promise<BinTransferRecord> =>
    tenantClient
      .post<{ success: boolean; binTransfer: BinTransferRecord }>(BASE, input)
      .then((r) => r.data.binTransfer),

  // A draft only: the server answers 409 for anything later.
  update: (uuid: string, input: BinTransferInput): Promise<BinTransferRecord> =>
    tenantClient
      .patch<{ success: boolean; binTransfer: BinTransferRecord }>(`${BASE}/${uuid}`, input)
      .then((r) => r.data.binTransfer),

  // A draft or cancelled transfer; the server's message for anything else says
  // what to do first, so it is shown verbatim.
  remove: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Submit, return to draft, revise or cancel. `note` is kept as the cancel
  // reason. Completing is NOT a transition: it moves stone, so it has its own call.
  transition: (uuid: string, toStatusCode: string, note?: string): Promise<BinTransferRecord> =>
    tenantClient
      .post<{ success: boolean; binTransfer: BinTransferRecord }>(
        `${BASE}/${uuid}/transition`, { toStatusCode, note },
      )
      .then((r) => r.data.binTransfer),

  // One configured approver's sign-off. 409 when nothing is configured, 403 for
  // someone who is not an approver (a super admin override aside).
  approve: (uuid: string): Promise<BinTransferRecord> =>
    tenantClient
      .post<{ success: boolean; binTransfer: BinTransferRecord }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.binTransfer),

  // An approver's veto: back to Draft with the reason kept (a reason is
  // required — 400 without one). The POST response carries no approval overlay,
  // so callers invalidate the record's query to pick up the rejection banner.
  reject: (uuid: string, reason: string): Promise<BinTransferRecord> =>
    tenantClient
      .post<{ success: boolean; binTransfer: BinTransferRecord }>(`${BASE}/${uuid}/reject`, { reason })
      .then((r) => r.data.binTransfer),

  // Applies the moves — every slab, or none. The error names the slab that got
  // in the way, so it is shown verbatim.
  complete: (uuid: string): Promise<BinTransferRecord> =>
    tenantClient
      .post<{ success: boolean; binTransfer: BinTransferRecord }>(`${BASE}/${uuid}/complete`, {})
      .then((r) => r.data.binTransfer),

  history: (uuid: string): Promise<DocHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: DocHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
