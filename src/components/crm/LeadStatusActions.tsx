import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { isCrmTransitionBlocked } from '@/lib/crmApproval';
import { leadStatusActions, type LeadStatusAction, type LeadStatusActionKey } from '@/lib/crmStatusFlow';
import { cn } from '@/lib/utils';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

type Props = {
  recordId: string;
  /** Code of the lead's current status. */
  statusCode: string | undefined;
  /** `record.approval.gated` — Mark Qualified is hidden behind it, Mark
   *  Unqualified stays clickable (see CRM_ALWAYS_ALLOWED_EXIT_CODES). */
  gated: boolean | undefined;
  /** The lead workflow's status catalog, to resolve each button's target id. */
  statuses: StatusInfo[];
  /** Called with the updated lead once its status has changed. */
  onChanged: (record: WorkflowRecord) => void;
};

const BUTTON_CLS: Record<LeadStatusActionKey, string> = {
  qualify:
    'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50',
  unqualify:
    'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50',
};

const ACTION_ICONS: Record<LeadStatusActionKey, typeof CheckCircle2> = {
  qualify: CheckCircle2,
  unqualify: XCircle,
};

// Lead's header status buttons: Mark Qualified / Mark Unqualified — the
// CRM_WORKFLOW_KEYS.LEAD parallel to CustomerStatusActions, but rendered in
// CrmPageHeader's `actions` slot (top-right) instead of the sidebar's Quick
// Actions card, since a New lead only ever has these two moves and they
// should be visible without opening anything. Which buttons show depends on
// the current status, per leadStatusActions — empty once the lead has moved
// past New. No confirm dialog: Unqualify can be undone by nothing, but
// neither could the dropdown option it replaces have been made safer without
// slowing down the common case.
export function LeadStatusActions({ recordId, statusCode, gated, statuses, onChanged }: Props) {
  const change = useMutation({
    mutationFn: ({ toStateId }: { action: LeadStatusAction; toStateId: string }) =>
      crmService.transitionRecord(recordId, toStateId, CRM_WORKFLOW_KEYS.LEAD),
    onSuccess: (record, { action }) => {
      toast.success(action.success);
      onChanged(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to change the lead's status.")),
  });

  // A button whose target status isn't in the catalog (still loading) can't fire.
  const buttons = leadStatusActions(statusCode).flatMap((action) => {
    const target = statuses.find((s) => s.stateKey === action.toStatus);
    return target ? [{ action, toStateId: target.stateId }] : [];
  });

  if (buttons.length === 0) return null;

  return (
    <>
      {buttons.map(({ action, toStateId }) => {
        const blocked = isCrmTransitionBlocked(gated ?? false, action.toStatus);
        const pending = change.isPending && change.variables?.action.key === action.key;
        const Icon = ACTION_ICONS[action.key];
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => { if (!blocked) change.mutate({ action, toStateId }); }}
            disabled={change.isPending}
            aria-disabled={blocked}
            title={blocked ? 'Awaiting approval sign-off' : undefined}
            className={cn(BUTTON_CLS[action.key], (change.isPending || blocked) && 'opacity-50', blocked && 'cursor-not-allowed')}
          >
            {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <Icon className="size-3.5 shrink-0" />}
            {action.label}
          </button>
        );
      })}
    </>
  );
}
