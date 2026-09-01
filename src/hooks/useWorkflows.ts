import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

const WORKFLOWS_STALE_TIME_MS = 5 * 60 * 1000;

export function useWorkflows() {
  // /tenant/workflows/enabled is a staff-configuration concept — a
  // customer-portal token is structurally confined away from /api/tenant/*
  // (middleware.RequireAuth) and would 403. Skip the call entirely rather
  // than let PermissionGuard's workflowKey check retry into a spurious
  // security-log entry (portal_token_outside_portal) on every customer page
  // load; isWorkflowEnabled below fails open the same way missing data
  // already does.
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  // Distinct from the ['workflows'] key used elsewhere for the full,
  // workflow:read-gated list (field definitions, approvers, etc.) — this
  // hook uses the unrestricted /tenant/workflows/enabled endpoint instead,
  // so a role with no Configuration access still gets a correct answer.
  const { data = [], isLoading } = useQuery({
    queryKey: ['workflows', 'enabled'],
    queryFn: workflowService.listEnabled,
    staleTime: WORKFLOWS_STALE_TIME_MS,
    enabled: !isPortal,
  });

  // A key the server doesn't return (not yet seeded, an API hiccup, or a
  // portal session that never asked) fails open — this only hides/blocks
  // workflows an admin explicitly disabled, it never masks missing data as
  // "disabled".
  function isWorkflowEnabled(key: string): boolean {
    if (isPortal) return true;
    const wf = data.find((w) => w.key.toLowerCase() === key.toLowerCase());
    return wf ? wf.enabled : true;
  }

  return { workflows: data, isLoading: isPortal ? false : isLoading, isWorkflowEnabled };
}
