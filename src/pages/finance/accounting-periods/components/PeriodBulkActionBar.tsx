import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Loader2, X } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import type { Period } from '@/types/accountingPeriod';

// Bulk close/reopen across the selected periods — one transaction inside the
// backend, applied oldest-first (close) or newest-first (reopen); a
// one-element list is the same code path as PeriodStatusDialog's single case.
// The action offered depends on the selection being uniformly open or
// uniformly closed — a mixed selection has no single sequencing-valid action,
// so it's refused client-side rather than sent to 409.
export function PeriodBulkActionBar({ selectedPeriods, onClear }: {
  selectedPeriods: Period[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const allOpen = selectedPeriods.length > 0 && selectedPeriods.every((p) => p.status === 'open');
  const allClosed = selectedPeriods.length > 0 && selectedPeriods.every((p) => p.status === 'closed');

  const bulk = useMutation({
    mutationFn: (closing: boolean) => {
      const payload = { periodIds: selectedPeriods.map((p) => p.id), note: note.trim() || undefined };
      return closing ? accountingPeriodService.closePeriods(payload) : accountingPeriodService.reopenPeriods(payload);
    },
    onSuccess: (result, closing) => {
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-current-period'] });
      queryClient.invalidateQueries({ queryKey: ['ap-calendar'] });
      setResultMessage(
        `${result.periods.length} period${result.periods.length === 1 ? '' : 's'} ${closing ? 'closed' : 'reopened'}.`,
      );
      setNote('');
      onClear();
    },
    onError: (err) => setResultMessage(parseAccountingPeriodError(err, 'Failed to update the selected periods.').message),
  });

  if (selectedPeriods.length === 0 && !resultMessage) return null;

  return (
    <div className="space-y-2">
      {selectedPeriods.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-foreground/20 bg-accent/10 px-3 py-2">
          <span className="text-xs font-semibold text-accent-foreground">{selectedPeriods.length} selected</span>

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
              aria-label={`Close ${selectedPeriods.length} selected periods`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {bulk.isPending ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
              Close Selected
            </button>
          )}
          {allClosed && (
            <button
              type="button"
              onClick={() => bulk.mutate(false)}
              disabled={bulk.isPending}
              aria-label={`Reopen ${selectedPeriods.length} selected periods`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {bulk.isPending ? <Loader2 className="size-3 animate-spin" /> : <Unlock className="size-3" />}
              Reopen Selected
            </button>
          )}
          {!allOpen && !allClosed && (
            <span className="text-2xs italic text-stone-400">Select periods that are all open or all closed.</span>
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
