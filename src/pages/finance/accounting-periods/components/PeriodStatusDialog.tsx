import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { Period } from '@/types/accountingPeriod';

// Confirms a single close/reopen. The 409 sequencing message (e.g. "Mar 2025
// cannot be closed while the earlier period Feb 2025 is still open.") is
// rendered verbatim — it already names the offending period and the rule,
// which is more useful than any paraphrase this dialog could write.
export function PeriodStatusDialog({ period, onClose }: { period: Period; onClose: () => void }) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const closing = period.status === 'open';
  const Icon = closing ? Lock : Unlock;

  const mutate = useMutation({
    mutationFn: () => {
      const payload = { periodIds: [period.id], note: note.trim() || undefined };
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
    ? parseAccountingPeriodError(mutate.error, `Failed to ${closing ? 'close' : 'reopen'} the period.`)
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
              {closing ? 'Close' : 'Reopen'} {period.name}?
            </h3>
            <p className="mt-0.5 text-xs text-stone-400">
              {closing
                ? 'Every earlier period must already be closed.'
                : 'Every later period must already be open.'}
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-all hover:bg-brand-hover disabled:opacity-50 active:scale-95"
          >
            {mutate.isPending ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
            {mutate.isPending ? (closing ? 'Closing…' : 'Reopening…') : closing ? 'Close Period' : 'Reopen Period'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
