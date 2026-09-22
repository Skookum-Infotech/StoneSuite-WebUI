import { useMutation } from '@tanstack/react-query';
import { Loader2, Power, PowerOff, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
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

// Same color language as Lead's header buttons (LeadStatusActions.tsx) and
// Prospect's (PendingConversionButton.tsx / MoveStageButton.tsx): solid
// brand for a button that sets Active, since that's the CRM's one shared
// "forward" color. Make Inactive reuses Lead's Mark Unqualified red — both
// are the same shape of action, a record the caller stops using. Credit Hold
// is the one deliberate departure: amber, matching CCHD's own status-pill
// color (STATUS_COLORS in formUtils.ts) rather than red, because it is a
// reversible restriction and not an exit — a red button would clash with
// the amber badge the record wears the moment it lands.
const BUTTON_CLS: Record<CustomerStatusActionKey, string> = {
  activate:
    'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50',
  release:
    'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50',
  inactivate:
    'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50',
  hold:
    'inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50',
};

// The customer's header status buttons: Make Active, Make Inactive, Credit
// Hold and Release Hold — the CRM_WORKFLOW_KEYS.CUSTOMER parallel to
// LeadStatusActions, rendered in CrmPageHeader's `actions` slot (top-right)
// instead of the sidebar's Quick Actions card. They are the ONLY way to
// change a customer's status — the status dropdown never lists these — and
// each goes through the ordinary transition endpoint, so the backend's rules
// and approval gate apply (customerStatusActions returns none while gated).
// Which buttons show depends on the current status, per CUSTOMER_STATUS_ACTIONS.
// No confirm dialog: every move can be undone with another button.
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
            className={cn(BUTTON_CLS[action.key], change.isPending && !pending && 'opacity-50')}
          >
            {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Icon className="size-3.5 shrink-0" />}
            {action.label}
          </button>
        );
      })}
    </>
  );
}
