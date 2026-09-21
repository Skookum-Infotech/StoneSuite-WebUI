import { useMutation } from '@tanstack/react-query';
import { Loader2, Power, PowerOff, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { quickActionRowCls } from '@/components/crm/formUtils';
import { customerStatusActions, type CustomerStatusAction, type CustomerStatusActionKey } from '@/lib/crmStatusFlow';
import { cn } from '@/lib/utils';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

type Props = {
  recordId: string;
  /** Code of the customer's current status. */
  statusCode: string | undefined;
  /** `record.approval.gated` — the buttons are hidden while it is true. */
  gated: boolean | undefined;
  /** The customer workflow's status catalog, to resolve each button's target id. */
  statuses: StatusInfo[];
  /** Called with the updated customer once its status has changed. */
  onChanged: (record: WorkflowRecord) => void;
};

const ACTION_ICONS: Record<CustomerStatusActionKey, LucideIcon> = {
  activate: Power,
  inactivate: PowerOff,
  hold: ShieldAlert,
  release: ShieldCheck,
};

// The customer's Quick Action buttons: Make Active, Make Inactive, Credit Hold
// and Release Hold. They are the ONLY way to change a customer's status — the
// status dropdown never lists these — and each goes through the ordinary
// transition endpoint, so the backend's rules and approval gate apply (the
// buttons are hidden while the customer is gated, and only Active customers can
// be used on other records). Which buttons show depends on the current status,
// per CUSTOMER_STATUS_ACTIONS. No confirm dialog: every move can be undone with
// another button. Render as the `quickActionsSlot` of CrmDetailSidebar.
export function CustomerStatusActions({ recordId, statusCode, gated, statuses, onChanged }: Props) {
  const change = useMutation({
    mutationFn: ({ toStateId }: { action: CustomerStatusAction; toStateId: string }) =>
      crmService.transitionRecord(recordId, toStateId, CRM_WORKFLOW_KEYS.CUSTOMER),
    onSuccess: (record, { action }) => {
      toast.success(action.success);
      onChanged(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to change the customer's status.")),
  });

  // A button whose target status isn't in the catalog (still loading) can't fire.
  const buttons = customerStatusActions(statusCode, gated).flatMap((action) => {
    const target = statuses.find((s) => s.stateKey === action.toStatus);
    return target ? [{ action, toStateId: target.stateId }] : [];
  });

  return (
    <>
      {buttons.map(({ action, toStateId }) => {
        const Icon = ACTION_ICONS[action.key];
        const pending = change.isPending && change.variables?.action.key === action.key;
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => change.mutate({ action, toStateId })}
            disabled={change.isPending}
            className={cn(quickActionRowCls, change.isPending && 'cursor-not-allowed opacity-60')}
            aria-label={action.label}
          >
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-stone-400" aria-hidden="true" />
            ) : (
              <Icon className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
            )}
            {action.label}
          </button>
        );
      })}
    </>
  );
}
