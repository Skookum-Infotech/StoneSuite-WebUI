import { tenantClient } from '@/api/tenantClient';
import type { WorkflowRecord } from '@/types/tenant';
import type { ApprovalInboxItem, ApprovalInboxModule, ApprovalInboxPage, ApprovalInboxParams } from '@/types/approvalInbox';

// GET /api/tenant/approvals/inbox -- everything awaiting the caller's sign-off
// across the document modules (APR-1). The server scopes and orders it (oldest
// first); `cursor` is the opaque keyset cursor and is only ever replayed.
interface InboxWire {
  success: boolean;
  items: ApprovalInboxItem[] | null;
  modules: ApprovalInboxModule[] | null;
  total?: number;
  isApprover?: boolean;
  nextCursor?: string;
}

export const approvalInboxService = {
  list: (params: ApprovalInboxParams): Promise<ApprovalInboxPage> =>
    tenantClient
      .get<InboxWire>('/tenant/approvals/inbox', { params })
      .then(({ data }) => ({
        items: data.items ?? [],
        modules: data.modules ?? [],
        total: data.total ?? 0,
        isApprover: Boolean(data.isApprover),
        nextCursor: data.nextCursor ?? '',
      })),

  /** CRM records (lead | prospect | customer) awaiting the caller's approval. */
  listCrmPending: (workflowKey: string): Promise<WorkflowRecord[]> =>
    tenantClient
      .get<{ success: boolean; records: WorkflowRecord[] | null }>(`/tenant/crm/${workflowKey}/approvals/pending`)
      .then((r) => r.data.records ?? []),
};
