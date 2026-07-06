import { tenantClient } from '@/api/tenantClient';
import type {
  WorkflowRecord, Workflow, StatusInfo, CRMCreatePayload, FilterRequest, RecordPage,
} from '@/types/tenant';

export const CRM_WORKFLOW_KEYS = {
  LEAD: 'lead',
  PROSPECT: 'prospect',
  CUSTOMER: 'customer',
} as const;

export type CRMWorkflowKey = typeof CRM_WORKFLOW_KEYS[keyof typeof CRM_WORKFLOW_KEYS];

export const crmService = {
  getAllStatuses: (): Promise<StatusInfo[]> =>
    tenantClient
      .get<{ success: boolean; statuses: StatusInfo[] }>('/tenant/crm/statuses')
      .then((r) => r.data.statuses ?? []),

  getWorkflowStatuses: (workflowKey: string): Promise<{ workflow: Workflow; statuses: StatusInfo[] }> =>
    tenantClient
      .get<{ success: boolean; workflow: Workflow; statuses: StatusInfo[] }>(
        `/tenant/crm/${workflowKey}/statuses`,
      )
      .then((r) => ({ workflow: r.data.workflow, statuses: r.data.statuses ?? [] })),

  listRecords: (workflowKey: string): Promise<WorkflowRecord[]> =>
    tenantClient
      .get<{ success: boolean; scope: string; records: WorkflowRecord[] }>(
        `/tenant/crm/${workflowKey}/records`,
      )
      .then((r) => r.data.records ?? []),

  // searchRecords drives server-side filtering, sorting, and keyset pagination.
  // The backend composes the request onto the caller's RBAC scope, so results
  // never include records outside the caller's scope.
  searchRecords: (workflowKey: string, req: FilterRequest): Promise<RecordPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: WorkflowRecord[];
        nextCursor: string; hasMore: boolean;
      }>(`/tenant/crm/${workflowKey}/records/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  createRecord: (workflowKey: string, payload: CRMCreatePayload): Promise<WorkflowRecord> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/crm/${workflowKey}/records`,
        payload,
      )
      .then((r) => r.data.record),

  // Per-record endpoints: workflowKey is required by the route pattern but
  // ignored by the handler (which loads the record by id). Pass the known
  // workflow key when available; fall back to '_' as a dummy segment.
  getRecord: (id: string, workflowKey = '_'): Promise<WorkflowRecord> =>
    tenantClient
      .get<{ success: boolean; record: WorkflowRecord }>(`/tenant/crm/${workflowKey}/records/${id}`)
      .then((r) => r.data.record),

  updateRecord: (
    id: string,
    payload: { coreFields?: Record<string, unknown>; customFields?: Record<string, unknown> },
    workflowKey = '_',
  ): Promise<void> =>
    tenantClient.patch(`/tenant/crm/${workflowKey}/records/${id}`, payload).then(() => undefined),

  deleteRecord: (id: string, workflowKey = '_', reason = ''): Promise<void> =>
    tenantClient.delete(`/tenant/crm/${workflowKey}/records/${id}`, { data: { reason } }).then(() => undefined),

  getAvailableTransitions: (id: string, workflowKey = '_'): Promise<StatusInfo[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; transitions: StatusInfo[] }>(
        `/tenant/crm/${workflowKey}/records/${id}/transitions`,
      )
      .then((r) => r.data.transitions ?? []),

  transitionRecord: (id: string, toStateId: string, workflowKey = '_'): Promise<WorkflowRecord> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/crm/${workflowKey}/records/${id}/transition`,
        { toStateId },
      )
      .then((r) => r.data.record),

  // Backend validates the caller is one of the workflow's configured
  // approverUserIds; the frontend's own check is only for showing/hiding the
  // Approve action, not the source of truth.
  approveRecord: (id: string, workflowKey = '_'): Promise<WorkflowRecord> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/crm/${workflowKey}/records/${id}/approve`,
        {},
      )
      .then((r) => r.data.record),

  convertRecord: (
    id: string,
    targetWorkflowKey: string,
    payload?: Partial<CRMCreatePayload>,
    workflowKey = '_',
  ): Promise<{ record: WorkflowRecord; sourceRecordId: string }> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord; sourceRecordId: string }>(
        `/tenant/crm/${workflowKey}/records/${id}/convert`,
        { targetWorkflowKey, ...payload },
      )
      .then((r) => ({ record: r.data.record, sourceRecordId: r.data.sourceRecordId })),

  getRecordAudit: (id: string, workflowKey = '_'): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(
        `/tenant/crm/${workflowKey}/records/${id}/audit`,
      )
      .then((r) => r.data.audit ?? []),
};

export type AuditEntry = {
  action: string;
  resource: string;
  actorName: string;
  ipAddress: string;
  appVersion: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  at: string;
};
