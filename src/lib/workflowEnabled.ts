import type { WorkflowStatus } from '@/types/tenant';

/**
 * A key the server doesn't return (not yet seeded, an API hiccup, or a
 * portal session whose backend hasn't shipped /api/portal/workflows/enabled
 * yet) fails open — this only hides/blocks workflows an admin explicitly
 * disabled, it never masks missing data as "disabled".
 */
export function resolveWorkflowEnabled(statuses: readonly WorkflowStatus[], key: string): boolean {
  const wf = statuses.find((w) => w.key.toLowerCase() === key.toLowerCase());
  return wf ? wf.enabled : true;
}
