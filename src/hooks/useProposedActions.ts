import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proposedActionService } from '@/services/proposedActionService';
import type { ProposedAction, ProposedActionConfirmResult } from '@/types/proposedAction';

// Default page size for the pending list; the server caps it (max 100).
const DEFAULT_LIST_LIMIT = 25;

/** Query-key factory. All keys share the ['proposed-actions'] root. */
export const proposedActionKeys = {
  all: ['proposed-actions'] as const,
  list: (limit: number = DEFAULT_LIST_LIMIT) => ['proposed-actions', 'list', limit] as const,
  detail: (id: string) => ['proposed-actions', 'detail', id] as const,
};

/**
 * Extension point: query keys to refresh after a confirmed action creates or
 * updates a record. The repo has no uniform per-resource key convention (CRM
 * pages use ['crm-records', <workflowKey>], documents use their own roots), so
 * only the actions keys are invalidated by default. Register a resource here
 * (resource name -> key prefixes) to refresh its lists on confirm. The three
 * resources document extraction can create are registered: the record lists and
 * the pickers a review form searches.
 */
export const RESOURCE_QUERY_KEYS: Record<string, ReadonlyArray<readonly unknown[]>> = {
  customer: [['crm-records', 'customer'], ['customer-picker']],
  vendor: [['vendors'], ['vendor-picker']],
  inventory_item: [['inventory-items'], ['inventory-item-picker']],
};

/** The caller's own proposed actions (server-scoped to the current user). */
export function useProposedActions(limit: number = DEFAULT_LIST_LIMIT) {
  return useQuery({
    queryKey: proposedActionKeys.list(limit),
    queryFn: () => proposedActionService.list({ limit }),
    select: (page) => page.actions.filter((a) => a.status === 'pending'),
  });
}

/** Confirms an action, then refreshes the actions queries and the target resource's keys. */
export function useConfirmProposedAction() {
  const qc = useQueryClient();
  return useMutation<ProposedActionConfirmResult, Error, string>({
    mutationFn: (id) => proposedActionService.confirm(id),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: proposedActionKeys.all });
      qc.invalidateQueries({ queryKey: proposedActionKeys.detail(id) });
      const resource = res.action.resultRef?.resource ?? res.action.resource;
      for (const key of RESOURCE_QUERY_KEYS[resource] ?? []) {
        qc.invalidateQueries({ queryKey: [...key] });
      }
    },
    // A 409/410/422 changes the action's server-side status; refetch so lists agree.
    onError: () => {
      qc.invalidateQueries({ queryKey: proposedActionKeys.all });
    },
  });
}

/** Cancels an action, then refreshes the actions queries. */
export function useCancelProposedAction() {
  const qc = useQueryClient();
  return useMutation<ProposedAction, Error, string>({
    mutationFn: (id) => proposedActionService.cancel(id),
    onSuccess: (_a, id) => {
      qc.invalidateQueries({ queryKey: proposedActionKeys.all });
      qc.invalidateQueries({ queryKey: proposedActionKeys.detail(id) });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: proposedActionKeys.all });
    },
  });
}
