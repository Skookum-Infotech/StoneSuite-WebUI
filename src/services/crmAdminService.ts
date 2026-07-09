import { tenantClient } from '@/api/tenantClient';

// A crm_workflow_approver row. crmStatusCode === '' means a wildcard
// (any-status) approver — those are managed via workflowService.setApprovers
// (the "Approval chain" section), not here. This service only concerns rows
// scoped to a specific status.
export interface CrmApprover {
  id: number;
  recordTypeCode: string;
  crmStatusCode: string;
  approverEmployeeId: number;
  approverName: string;
  isActive: boolean;
}

export interface CreateCrmApproverPayload {
  recordTypeCode: string;
  crmStatusCode: string;
  approverEmployeeId: number;
}

export const crmAdminService = {
  listApprovers: (): Promise<CrmApprover[]> =>
    tenantClient
      .get<{ success: boolean; approvers: CrmApprover[] }>('/tenant/config/approvers')
      .then((r) => r.data.approvers ?? []),

  createApprover: (payload: CreateCrmApproverPayload): Promise<void> =>
    tenantClient.post('/tenant/config/approvers', payload).then(() => undefined),

  deleteApprover: (id: number): Promise<void> =>
    tenantClient.delete(`/tenant/config/approvers/${id}`).then(() => undefined),
};
