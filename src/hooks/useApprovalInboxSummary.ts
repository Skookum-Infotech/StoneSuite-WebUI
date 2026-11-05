import { useQuery } from '@tanstack/react-query';
import { approvalInboxService } from '@/services/approvalInboxService';
import { useAuthStore } from '@/store/useAuthStore';
import { INBOX_COUNT_LIMIT } from '@/lib/approvalInbox';

export const APPROVALS_INBOX_KEY = 'approvals-inbox';

// Cached a minute so the sidebar badge costs one limit=1 call per minute at
// most, however many pages the user opens.
const SUMMARY_STALE_MS = 60_000;

/** Pending total + approver flag behind the sidebar's Approvals badge. Disabled
 *  for portal sessions, which have no inbox. Errors read as "nothing pending". */
export function useApprovalInboxSummary(): { total: number; isApprover: boolean } {
  const enabled = useAuthStore((s) => s.isAuthenticated && s.kind !== 'portal');

  const summaryQ = useQuery({
    queryKey: [APPROVALS_INBOX_KEY, 'summary'],
    queryFn: () => approvalInboxService.list({ scope: 'mine', limit: INBOX_COUNT_LIMIT }),
    enabled,
    staleTime: SUMMARY_STALE_MS,
    retry: false,
  });

  return { total: summaryQ.data?.total ?? 0, isApprover: summaryQ.data?.isApprover ?? false };
}
