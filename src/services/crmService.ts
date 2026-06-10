import { tenantClient } from '@/api/tenantClient';
import type { WorkflowRecord, Workflow, StatusInfo, CRMCreatePayload } from '@/types/tenant';

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

  createRecord: (workflowKey: string, payload: CRMCreatePayload): Promise<WorkflowRecord> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/crm/${workflowKey}/records`,
        payload,
      )
      .then((r) => r.data.record),

  getRecord: (id: string): Promise<WorkflowRecord> =>
    tenantClient
      .get<{ success: boolean; record: WorkflowRecord }>(`/tenant/crm/records/${id}`)
      .then((r) => r.data.record),

  updateRecord: (
    id: string,
    payload: { coreFields?: Record<string, unknown>; customFields?: Record<string, unknown> },
  ): Promise<void> =>
    tenantClient.patch(`/tenant/crm/records/${id}`, payload).then(() => undefined),

  deleteRecord: (id: string): Promise<void> =>
    tenantClient.delete(`/tenant/crm/records/${id}`).then(() => undefined),

  getAvailableTransitions: (id: string): Promise<StatusInfo[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; transitions: StatusInfo[] }>(
        `/tenant/crm/records/${id}/transitions`,
      )
      .then((r) => r.data.transitions ?? []),

  transitionRecord: (id: string, toStateId: string): Promise<WorkflowRecord> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord }>(
        `/tenant/crm/records/${id}/transition`,
        { toStateId },
      )
      .then((r) => r.data.record),

  convertRecord: (
    id: string,
    targetWorkflowKey: string,
    payload?: Partial<CRMCreatePayload>,
  ): Promise<{ record: WorkflowRecord; sourceRecordId: string }> =>
    tenantClient
      .post<{ success: boolean; record: WorkflowRecord; sourceRecordId: string }>(
        `/tenant/crm/records/${id}/convert`,
        { targetWorkflowKey, ...payload },
      )
      .then((r) => ({ record: r.data.record, sourceRecordId: r.data.sourceRecordId })),
};
