import { useQuery } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { Badge } from '@/components/tenant/ui';
import { readonlyCls, resolveStatusColor } from '@/components/crm/formUtils';

const STATUS_CATALOG_STALE_MS = 10 * 60 * 1000;

type Props = {
  /** CRM workflow key: 'lead' | 'prospect' | 'customer'. */
  workflowKey: string;
  /** Id of the record's current status (`record.currentStateId`). */
  statusId: string;
};

// Read-only Status field for an Edit page whose status can't be changed there. A
// customer's status changes only with the Quick Action buttons on its detail
// page, so the Edit form shows it instead of offering a dropdown. Reads the
// workflow's status catalog (the same query StatusDropdown uses, so a cache hit).
export function CurrentStatusField({ workflowKey, statusId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-statuses-workflow', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    staleTime: STATUS_CATALOG_STALE_MS,
  });
  const current = data?.statuses.find((s) => s.stateId === statusId);

  return (
    <div className={readonlyCls}>
      {current ? (
        <Badge color={resolveStatusColor(current.stateKey, current.color)}>{current.statusLabel}</Badge>
      ) : (
        <span className="text-stone-400">{isLoading ? 'Loading…' : '—'}</span>
      )}
    </div>
  );
}
