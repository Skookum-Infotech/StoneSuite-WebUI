import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { LOCK_STATUS_FIELDS, LOCK_TARGET_LABELS, type LockTarget, type Period } from '@/types/accountingPeriod';

/** Locking G/L is the only one of the four that stops anything today —
 *  journal.CreateEntry reads gl_lock_status at its choke point. A/P and A/R
 *  are recorded and audited but have no posting module consuming them yet, so
 *  the dialog says so rather than implying a guard that does not exist. */
const TARGET_HINTS: Record<LockTarget, { closing: string; reopening: string }> = {
  period: {
    closing: 'Closes all three sub-ledgers. Every earlier period must already be closed.',
    reopening: 'Reopens all three sub-ledgers. Every later period must already be open.',
  },
  ap: {
    closing: 'Recorded and audited; no posting module enforces it yet. Every earlier period must already be locked for A/P.',
    reopening: 'Every later period must already be unlocked for A/P.',
  },
  ar: {
    closing: 'Recorded and audited; no posting module enforces it yet. Every earlier period must already be locked for A/R.',
    reopening: 'Every later period must already be unlocked for A/R.',
  },
  gl: {
    closing: 'Blocks every journal entry dated in this period. Every earlier period must already be locked for G/L.',
    reopening: 'Allows journal entries dated in this period again. Every later period must already be unlocked for G/L.',
  },
};

/** The four verbs this dialog can perform, with the progressive form the
 *  pending button label needs. */
const VERBS = {
  Close: 'Closing',
  Reopen: 'Reopening',
  Lock: 'Locking',
  Unlock: 'Unlocking',
} as const;

type Verb = keyof typeof VERBS;

function currentStatus(period: Period, target: LockTarget) {
  return target === 'period' ? period.status : period[LOCK_STATUS_FIELDS[target]];
}

// Confirms a single close/reopen, on the whole period or on one sub-ledger
// lock. The 409 sequencing message (e.g. "GL for Mar 2025 cannot be closed
// while the earlier period GL for Feb 2025 is still open.") is rendered
// verbatim — it already names the offending period, the dimension and the
// rule, which is more useful than any paraphrase this dialog could write.
export function PeriodStatusDialog({ period, target, onClose }: {
  period: Period;
  target: LockTarget;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const wholePeriod = target === 'period';
  const closing = currentStatus(period, target) === 'open';
  const Icon = closing ? Lock : Unlock;
  const verb: Verb = wholePeriod ? (closing ? 'Close' : 'Reopen') : closing ? 'Lock' : 'Unlock';
  const title = wholePeriod
    ? `${verb} ${period.name}?`
    : `${verb} ${LOCK_TARGET_LABELS[target]} for ${period.name}?`;

  const mutate = useMutation({
    mutationFn: () => {
      const payload = { periodIds: [period.id], note: note.trim() || undefined };
      if (!wholePeriod) return accountingPeriodService.changePeriodLock(target, closing, payload);
      return closing
        ? accountingPeriodService.closePeriods(payload)
        : accountingPeriodService.reopenPeriods(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-current-period'] });
      queryClient.invalidateQueries({ queryKey: ['ap-calendar'] });
      onClose();
    },
  });

  const errorInfo = mutate.error
    ? parseAccountingPeriodError(mutate.error, `Failed to ${verb.toLowerCase()} the period.`)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-status-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', closing ? 'bg-amber-100' : 'bg-emerald-100')}>
            <Icon className={cn('size-4', closing ? 'text-amber-600' : 'text-emerald-600')} />
          </div>
          <div>
            <h3 id="period-status-dialog-title" className="text-sm font-bold text-stone-900">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-stone-400">
              {closing ? TARGET_HINTS[target].closing : TARGET_HINTS[target].reopening}
            </p>
          </div>
        </div>

        <label htmlFor="period-status-note" className="mb-1.5 block text-xs font-semibold text-stone-900">
          Note (optional)
        </label>
        <textarea
          id="period-status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={cn(textareaCls, 'mb-4')}
          aria-label="Note"
        />

        {errorInfo && <p role="alert" className="mb-3 text-xs text-destructive">{errorInfo.message}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutate.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutate.mutate()}
            disabled={mutate.isPending}
            aria-label={title}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-all hover:bg-brand-hover disabled:opacity-50 active:scale-95"
          >
            {mutate.isPending ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
            {mutate.isPending
              ? `${VERBS[verb]}…`
              : wholePeriod ? `${verb} Period` : `${verb} ${LOCK_TARGET_LABELS[target]}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
