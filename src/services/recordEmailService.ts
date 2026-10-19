import { tenantClient } from '@/api/tenantClient';
import type { RecordEmailThread } from '@/types/recordEmail';

// Record-keyed email conversation endpoints (`/api/tenant/records/{id}/emails`),
// the same shape as documentService's `/document/...` routes: one route serves
// every record type that keeps a thread (today the Sales Order).
export const recordEmailService = {
  // A record's conversation, oldest first. RBAC: <type>:read.
  list: (recordId: string): Promise<RecordEmailThread> =>
    tenantClient
      .get<{ success: boolean; enabled?: boolean; messages?: RecordEmailThread['messages'] | null }>(
        `/tenant/records/${recordId}/emails`,
      )
      .then((r) => ({ enabled: r.data.enabled ?? false, messages: r.data.messages ?? [] })),
};
