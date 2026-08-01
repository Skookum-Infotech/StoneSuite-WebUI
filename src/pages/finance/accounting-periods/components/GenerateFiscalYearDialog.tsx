import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { useModalDialog } from '@/hooks/useModalDialog';
import { predictNextFiscalYears } from '@/lib/fiscalYearPreview';
import { formatDateRange } from '@/lib/accountingPeriodTree';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldLabelCls, readonlyCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { MAX_GENERATE_YEARS } from '@/types/accountingPeriod';
import type { AccountingCalendar, FiscalYear } from '@/types/accountingPeriod';

const YEAR_OPTIONS = Array.from({ length: MAX_GENERATE_YEARS }, (_, i) => i + 1);

/** "2026-01-01T00:00:00.000Z" -> "January 2026". Locked-field display only —
 *  the calendar's own values, never user-editable here (see CalendarSetupCard). */
function monthYearLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** 1-12 -> "January". Built from a fixed reference date rather than a
 *  hardcoded month-name array, so there is only one source of month names
 *  (Intl) instead of a table that could drift from MonthYearPicker's. */
function monthName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' });
}

function years(n: number): string {
  return `${n} fiscal year${n === 1 ? '' : 's'}`;
}

// Confirms and generates the next 1-MAX_GENERATE_YEARS contiguous fiscal
// years. Still no arbitrary year picker — StartYear stays a confirmation the
// server checks, not a choice the UI offers; the batch always starts at
// whatever year contiguously follows the latest one on record. "Years to
// generate" IS a real choice, and it sits last, right above Generate, so
// changing it is the final thing an accounting user does before confirming —
// the live preview above it is what reacts. Picked a one-tap number grid over
// a <select>: opening a dropdown and then choosing is two actions where one
// click is enough, and every value is visible up front instead of hidden
// until opened. The fiscal calendar fields are shown locked, for context,
// since CalendarSetupCard is the only place they can ever be set.
export function GenerateFiscalYearDialog({ onClose, fiscalYears, calendar }: {
  onClose: () => void;
  fiscalYears: FiscalYear[];
  calendar: AccountingCalendar;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [yearCount, setYearCount] = useState(1);

  const generate = useMutation({
    mutationFn: () => accountingPeriodService.generateFiscalYear({ years: yearCount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
    },
  });

  const errorInfo = generate.error
    ? parseAccountingPeriodError(generate.error, 'Failed to generate the fiscal year.')
    : null;
  const previews = predictNextFiscalYears(fiscalYears[fiscalYears.length - 1]?.end, yearCount);
  const firstPreview = previews[0];
  const lastPreview = previews[previews.length - 1];
  const generated = generate.data ?? [];
  const rangeLabel = (list: { name: string }[]) =>
    list.length > 1 ? `${list[0].name} – ${list[list.length - 1].name}` : list[0]?.name;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-fy-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <CalendarPlus className="size-4 text-accent-foreground" />
          </div>
          <h3 id="generate-fy-dialog-title" className="text-sm font-bold text-stone-900">
            {generate.isSuccess ? 'Fiscal year generated' : 'Generate fiscal years'}
          </h3>
        </div>

        {/* The dynamic result — largest, highest-contrast text in the dialog,
            since this is the one thing that changes as the user picks a
            count and is what they need to read at a glance before confirming. */}
        <div
          className={cn(
            'mb-4 rounded-lg border px-3.5 py-3',
            generate.isSuccess ? 'border-emerald-200 bg-emerald-50' : 'border-accent-foreground/15 bg-accent/50',
          )}
        >
          <p className={cn('text-base font-bold tabular-nums', generate.isSuccess ? 'text-emerald-800' : 'text-stone-900')}>
            {generate.isSuccess
              ? rangeLabel(generated) ?? 'Done'
              : firstPreview
                ? rangeLabel(previews)
                : 'Next fiscal year'}
          </p>
          <p className={cn('mt-1 text-sm font-medium', generate.isSuccess ? 'text-emerald-700' : 'text-stone-600')}>
            {generate.isSuccess
              ? `${years(generated.length)} generated · ${generated.length * 12} periods, all open.`
              : firstPreview
                ? `${formatDateRange(firstPreview.start, lastPreview.end)} · ${years(previews.length)} · ${previews.length * 12} periods, all open.`
                : 'Creates the next twelve monthly periods, all open.'}
          </p>
        </div>

        {!generate.isSuccess && (
          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ModernFieldShell label="Fiscal year start month">
                <p className={readonlyCls} aria-label="Fiscal year start month (locked)">
                  {monthName(calendar.fiscalYearStartMonth ?? 1)}
                </p>
              </ModernFieldShell>
              <ModernFieldShell label="Base period">
                <p className={readonlyCls} aria-label="Base period, go-live month (locked)">
                  {calendar.basePeriodStart ? monthYearLabel(calendar.basePeriodStart) : '—'}
                </p>
              </ModernFieldShell>
            </div>

            <div className="space-y-1.5">
              <span className={fieldLabelCls}>Years to generate</span>
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Years to generate">
                {YEAR_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setYearCount(n)}
                    disabled={generate.isPending}
                    aria-pressed={yearCount === n}
                    aria-label={years(n)}
                    className={cn(
                      'rounded-lg py-2 text-sm font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      yearCount === n
                        ? 'bg-brand text-stone-950 shadow-sm'
                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
