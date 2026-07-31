import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { useModalDialog } from '@/hooks/useModalDialog';
import { predictNextFiscalYear } from '@/lib/fiscalYearPreview';
import { formatDateRange } from '@/lib/accountingPeriodTree';
import type { FiscalYear } from '@/types/accountingPeriod';

// Confirms and generates the next contiguous fiscal year. No year picker —
// StartYear is a confirmation the server checks, not a choice the UI offers;
// the tenant always gets whatever year contiguously follows the latest one
// on record. What we CAN do is predict it (predictNextFiscalYear mirrors the
// backend's own rule) and show the name + date range up front, so the
// confirmation is concrete rather than a blind "Generate?".
export function GenerateFiscalYearDialog({ onClose, fiscalYears }: {
  onClose: () => void;
  fiscalYears: FiscalYear[];
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => accountingPeriodService.generateFiscalYear(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
    },
  });

  const errorInfo = generate.error
    ? parseAccountingPeriodError(generate.error, 'Failed to generate the fiscal year.')
    : null;
  const preview = predictNextFiscalYear(fiscalYears[fiscalYears.length - 1]?.end);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-fy-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <CalendarPlus className="size-4 text-accent-foreground" />
          </div>
          <div>
            <h3 id="generate-fy-dialog-title" className="text-sm font-bold text-stone-900">
              {generate.isSuccess
                ? 'Fiscal year generated'
                : preview ? `Generate ${preview.name}?` : 'Generate the next fiscal year?'}
            </h3>
            <p className="mt-0.5 text-xs text-stone-400">
              {generate.isSuccess
                ? `${generate.data?.name} is ready with twelve open periods.`
                : preview
                  ? `${formatDateRange(preview.start, preview.end)} — twelve monthly periods, all open.`
                  : 'Creates the next twelve monthly periods, all open.'}
            </p>
          </div>
        </div>

        {errorInfo && <p role="alert" className="mb-3 text-xs text-destructive">{errorInfo.message}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={generate.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            {generate.isSuccess ? 'Close' : 'Cancel'}
          </button>
          {!generate.isSuccess && (
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-all hover:bg-brand-hover disabled:opacity-50 active:scale-95"
            >
              {generate.isPending ? <Loader2 className="size-3 animate-spin" /> : <CalendarPlus className="size-3" />}
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
