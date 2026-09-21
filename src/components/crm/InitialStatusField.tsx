import { useQuery } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { Badge } from '@/components/tenant/ui';
import { readonlyCls, resolveStatusColor } from '@/components/crm/formUtils';

const STATUS_CATALOG_STALE_MS = 10 * 60 * 1000;

type Props = {
  /** CRM workflow key: 'lead' | 'prospect' | 'customer'. */
  workflowKey: string;
};

// Read-only Status field for the Add pages. A new record always starts in its
// stage's initial status (Lead New / Prospect New / Customer Draft) and the
// server assigns it, so there is nothing to choose and nothing to send — this
// shows where the record will land instead of offering a dropdown. `isInitial`
// comes from the server (crmstore's crmInitialStatusCode), so the label can
// never drift from what actually gets saved.
export function InitialStatusField({ workflowKey }: Props) {
  // Same query key/fn as StatusDropdown's catalog, so this is a cache hit.
  const { data, isLoading } = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    staleTime: STATUS_CATALOG_STALE_MS,
  });
  const initial = data?.statuses.find((s) => s.isInitial);

  return (
    <div className={readonlyCls}>
      {initial ? (
        <Badge color={resolveStatusColor(initial.stateKey, initial.color)}>{initial.statusLabel}</Badge>
      ) : (
        <span className="text-stone-400">{isLoading ? 'Loading…' : '—'}</span>
      )}
    </div>
  );
}
