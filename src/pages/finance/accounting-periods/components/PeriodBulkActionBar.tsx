import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Loader2, X } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { LOCK_STATUS_FIELDS, LOCK_TARGET_LABELS, type LockTarget, type Period } from '@/types/accountingPeriod';

const TARGETS: readonly LockTarget[] = ['period', 'ap', 'ar', 'gl'];

/** Past-tense wording for the result banner, per target and direction. */
const RESULT_VERBS: Record<LockTarget, { closing: string; reopening: string }> = {
  period: { closing: 'closed', reopening: 'reopened' },
  ap: { closing: 'locked for A/P', reopening: 'unlocked for A/P' },
  ar: { closing: 'locked for A/R', reopening: 'unlocked for A/R' },
  gl: { closing: 'locked for G/L', reopening: 'unlocked for G/L' },
};

function statusFor(period: Period, target: LockTarget) {
  return target === 'period' ? period.status : period[LOCK_STATUS_FIELDS[target]];
}

// Bulk close/reopen across the selected periods, on the whole period or on
// one sub-ledger lock — one transaction inside the backend, applied
// oldest-first (close) or newest-first (reopen); a one-element list is the
// same code path as PeriodStatusDialog's single case. The action offered
// depends on the selection being uniformly open or uniformly closed ON THE
// CHOSEN TARGET — the three locks move independently, so a selection that is
// mixed for A/P may still be uniform for G/L. A mixed selection has no single
// sequencing-valid action, so it's refused client-side rather than sent to 409.
export function PeriodBulkActionBar({ selectedPeriods, onClear }: {
  selectedPeriods: Period[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [target, setTarget] = useState<LockTarget>('period');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const allOpen = selectedPeriods.length > 0 && selectedPeriods.every((p) => statusFor(p, target) === 'open');
  const allClosed = selectedPeriods.length > 0 && selectedPeriods.every((p) => statusFor(p, target) === 'closed');
  const wholePeriod = target === 'period';

  const bulk = useMutation({
    mutationFn: (closing: boolean) => {
      const payload = { periodIds: selectedPeriods.map((p) => p.id), note: note.trim() || undefined };
      if (!wholePeriod) return accountingPeriodService.changePeriodLock(target, closing, payload);
      return closing ? accountingPeriodService.closePeriods(payload) : accountingPeriodService.reopenPeriods(payload);
    },
    onSuccess: (result, closing) => {
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-current-period'] });
      queryClient.invalidateQueries({ queryKey: ['ap-calendar'] });
      const verb = closing ? RESULT_VERBS[target].closing : RESULT_VERBS[target].reopening;
      setResultMessage(
        `${result.periods.length} period${result.periods.length === 1 ? '' : 's'} ${verb}.`,
      );
      setNote('');
      onClear();
    },
    onError: (err) => setResultMessage(parseAccountingPeriodError(err, 'Failed to update the selected periods.').message),
  });

  if (selectedPeriods.length === 0 && !resultMessage) return null;

  const closeLabel = wholePeriod ? 'Close Selected' : `Lock ${LOCK_TARGET_LABELS[target]}`;
  const reopenLabel = wholePeriod ? 'Reopen Selected' : `Unlock ${LOCK_TARGET_LABELS[target]}`;

  return (
    <div className="space-y-2">
      {selectedPeriods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-foreground/20 bg-accent/10 px-3 py-2">
          <span className="text-xs font-semibold text-accent-foreground">{selectedPeriods.length} selected</span>

          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as LockTarget)}
            aria-label="Choose what to lock or unlock on the selected periods"
            className="h-7 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {TARGETS.map((t) => (
              <option key={t} value={t}>{LOCK_TARGET_LABELS[t]}</option>
            ))}
          </select>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note for the selected periods"
            className="h-7 min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-2 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          {allOpen && (
            <button
              type="button"
              onClick={() => bulk.mutate(true)}
              disabled={bulk.isPending}
              aria-label={`${closeLabel} for ${selectedPeriods.length} selected periods`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {bulk.isPending ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
              {closeLabel}
            </button>
          )}
          {allClosed && (
            <button
              type="button"
              onClick={() => bulk.mutate(false)}
              disabled={bulk.isPending}
              aria-label={`${reopenLabel} for ${selectedPeriods.length} selected periods`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {bulk.isPending ? <Loader2 className="size-3 animate-spin" /> : <Unlock className="size-3" />}
              {reopenLabel}
            </button>
          )}
          {!allOpen && !allClosed && (
            <span className="text-2xs italic text-stone-400">
              Select periods that are all open or all closed for {LOCK_TARGET_LABELS[target]}.
            </span>
          )}

          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="ml-auto rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {resultMessage && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-xs text-stone-600">
          {resultMessage}
          <button
            type="button"
            onClick={() => setResultMessage(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
