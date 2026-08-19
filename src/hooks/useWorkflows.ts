import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/services/tenantServices';

const WORKFLOWS_STALE_TIME_MS = 5 * 60 * 1000;

export function useWorkflows() {
  // Distinct from the ['workflows'] key used elsewhere for the full,
  // workflow:read-gated list (field definitions, approvers, etc.) — this
  // hook uses the unrestricted /tenant/workflows/enabled endpoint instead,
  // so a role with no Configuration access still gets a correct answer.
  const { data = [], isLoading } = useQuery({
    queryKey: ['workflows', 'enabled'],
    queryFn: workflowService.listEnabled,
    staleTime: WORKFLOWS_STALE_TIME_MS,
  });

  // A key the server doesn't return (not yet seeded, or an API hiccup) fails
  // open — this only hides/blocks workflows an admin explicitly disabled, it
  // never masks missing data as "disabled".
  function isWorkflowEnabled(key: string): boolean {
    const wf = data.find((w) => w.key.toLowerCase() === key.toLowerCase());
    return wf ? wf.enabled : true;
  }

  return { workflows: data, isLoading, isWorkflowEnabled };
}
