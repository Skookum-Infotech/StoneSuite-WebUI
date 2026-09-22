import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MoveRight, ChevronDown, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { isCrmTransitionBlocked } from '@/lib/crmApproval';
import { resolveStatusColor } from '@/components/crm/formUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

type Props = {
  workflowKey: string;
  /** The record whose legal next moves are listed. */
  recordId: string;
  /** Id of the record's current status — keys the /transitions fetch, same as
   *  StatusDropdown, so a stale list from the old status is never reused. */
  currentStateId: string;
  /** `record.approval.gated` — every option except the stage's own
   *  always-allowed exit (e.g. Closed Lost) renders disabled with a tooltip
   *  instead of firing and 409ing server-side. */
  gated?: boolean;
  /** Called with the updated record once its status has changed. */
  onChanged: (record: WorkflowRecord) => void;
};

// The CRM-standard "Move Stage ▾" split button — Prospect's header parallel to
// StatusDropdown's 'pill' variant, built on the app's Popover primitive
// (radix-ui) instead of the hand-rolled floating panel: with up to six legal
// destinations at once (five working statuses plus Closed Lost), a real
// popover's built-in focus trap, outside-click and Escape handling earns its
// keep in a way it didn't for Lead's two-button case. The current status is
// already visible via CrmPageHeader's `statusBadge` next to the title, so
// this trigger keeps a constant label rather than re-showing it. Tinted
// brand (not solid) — the same color language as Lead's header buttons
// (solid brand for a decisive forward move, red only for an exit like
// Closed Lost), but a lighter weight than PendingConversionButton /
// ConvertRecordButton's solid brand so the two stay tellable apart on a
// working prospect, where both render in the header at once.
//
// Options come from the live per-record /transitions endpoint, same as
// StatusDropdown, fetched only once the popover is opened. A click on a
// terminal destination (Closed Lost) arms a "Confirm: <label>" second click
// instead of firing immediately — same two-step guard StatusDropdown's pill
// variant uses, carried over because an accidental click matters more in a
// six-option menu than a two-button pair.
export function MoveStageButton({ workflowKey, recordId, currentStateId, gated = false, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [armedStateId, setArmedStateId] = useState<string | null>(null);

  const transitionsQuery = useQuery({
    queryKey: ['crm-transitions', recordId, currentStateId],
    queryFn: () => crmService.getAvailableTransitions(recordId, workflowKey),
    enabled: Boolean(recordId) && open,
  });
  const options = transitionsQuery.data ?? [];

  const move = useMutation({
    mutationFn: ({ stateId }: { stateId: string; label: string }) =>
      crmService.transitionRecord(recordId, stateId, workflowKey),
    onSuccess: (record, { label }) => {
      toast.success(`Moved to ${label}.`);
      onChanged(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to change the record's status.")),
  });

  function closeAll() {
    setOpen(false);
    setArmedStateId(null);
  }

  function selectOption(s: StatusInfo) {
    if (isCrmTransitionBlocked(gated, s.stateKey)) return;
    if (s.isTerminal && armedStateId !== s.stateId) {
      setArmedStateId(s.stateId);
      return;
    }
    move.mutate({ stateId: s.stateId, label: s.statusLabel });
    closeAll();
  }

  return (
    <Popover open={open} onOpenChange={(next) => { if (!move.isPending) { setOpen(next); if (!next) setArmedStateId(null); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={move.isPending}
          aria-label="Move to a different stage"
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {move.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <MoveRight className="size-3.5" />}
          Move Stage
          <ChevronDown className="size-3 text-stone-500" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div role="listbox" aria-label="Move to stage">
          {options.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-stone-400">
              {transitionsQuery.isLoading ? 'Loading…' : 'No further status changes.'}
            </p>
          ) : (
            options.map((s) => {
              const blocked = isCrmTransitionBlocked(gated, s.stateKey);
              const armed = armedStateId === s.stateId;
              const color = resolveStatusColor(s.stateKey, s.color);
              return (
                <button
                  key={s.stateId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-disabled={blocked}
                  title={blocked ? 'Awaiting approval sign-off' : undefined}
                  onClick={() => selectOption(s)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    blocked
                      ? 'cursor-not-allowed text-stone-300'
                      : armed
                        ? 'bg-red-50 font-semibold text-red-700'
                        : 'text-stone-700 hover:bg-stone-100',
                  )}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: blocked ? '#d6d3d1' : color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{armed ? `Confirm: ${s.statusLabel}` : s.statusLabel}</span>
                  {armed && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
