import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getAIStatus } from '@/services/aiService';
import { useAuthStore } from '@/store/useAuthStore';
import type { AIStatus } from '@/types/ai';

// How long a fetched status stays fresh before a background refetch — cheap
// enough to poll implicitly on every mount without hammering the endpoint,
// while still catching a platform/tenant toggle flip within about a minute.
const AI_STATUS_STALE_MS = 60 * 1000;

/** Whether the StoneSuite Assistant is available to the caller — gates the
 *  Help menu entry and backs both settings toggles. The assistant lives
 *  under /api/tenant/*, which a customer-portal token can't reach, so this
 *  never fetches for a portal session (same guard as useUserPermissions). */
export function useAIStatus(): UseQueryResult<AIStatus> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  return useQuery({
    queryKey: ['ai-status'],
    queryFn: getAIStatus,
    enabled: isAuthenticated && !isPortal,
    staleTime: AI_STATUS_STALE_MS,
  });
}
