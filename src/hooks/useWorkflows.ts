import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';
import { resolveWorkflowEnabled } from '@/lib/workflowEnabled';

const WORKFLOWS_STALE_TIME_MS = 5 * 60 * 1000;

export function useWorkflows() {
  // Cache-key scoping only — workflowService.listEnabled branches the
  // request path itself (portal vs. tenant), so there is no portal
  // special-case in the gating logic here: a workflow an admin disabled
  // must block a customer exactly as it blocks staff.
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  // Distinct from the ['workflows'] key used elsewhere for the full,
  // workflow:read-gated list (field definitions, approvers, etc.) — this
  // hook uses the unrestricted .../workflows/enabled endpoint instead, so a
  // role with no Configuration access still gets a correct answer.
  const { data = [], isLoading } = useQuery({
    queryKey: ['workflows', 'enabled', isPortal ? 'portal' : 'tenant'],
    queryFn: workflowService.listEnabled,
    staleTime: WORKFLOWS_STALE_TIME_MS,
    // One attempt: on a backend without the portal route this is a 404, and
    // retrying only doubles the noise. Failure falls open via the empty list.
    retry: false,
  });

  function isWorkflowEnabled(key: string): boolean {
    return resolveWorkflowEnabled(data, key);
  }

  return { workflows: data, isLoading, isWorkflowEnabled };
}
