import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2, AlertCircle } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { parseAccountingPeriodError } from '@/lib/accountingPeriodErrors';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, fieldErrorCls } from '@/components/crm/formUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// One-time fiscal calendar setup, shown in place of the tree until
// calendar.configured is true. Deliberately not idempotent server-side — a
// second submission 409s rather than reconfiguring, since changing a live
// tenant's fiscal-year start month would silently re-bucket every posted
// journal entry. There is no edit affordance here by design.
export function CalendarSetupCard() {
  const queryClient = useQueryClient();
  const [startMonth, setStartMonth] = useState(1);
  const [baseMonth, setBaseMonth] = useState(''); // yyyy-mm from <input type="month">
  const [showErrors, setShowErrors] = useState(false);

  const setup = useMutation({
    mutationFn: () =>
      accountingPeriodService.setupCalendar({
        fiscalYearStartMonth: startMonth,
        basePeriodStart: `${baseMonth}-01`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['ap-fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['ap-periods'] });
    },
  });

  const errorInfo = setup.error
    ? parseAccountingPeriodError(setup.error, 'Failed to set up the fiscal calendar.')
    : null;
  const missingBase = !baseMonth;

  function handleSubmit() {
    if (missingBase) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setup.mutate();
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
          <CalendarClock className="size-5 text-accent-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-stone-900">Set up your fiscal calendar</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            One-time setup — this cannot be changed afterward. Reconfiguring a live calendar
            would re-bucket every journal entry already posted.
          </p>
        </div>
      </div>

      {errorInfo && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />
          <p className="text-xs text-red-700">{errorInfo.message}</p>
        </div>
      )}

      <div className="space-y-4">
        <ModernFieldShell label="Fiscal year start month" required>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(Number(e.target.value))}
            className={fieldCls}
            aria-label="Fiscal year start month"
          >
            {MONTH_NAMES.map((label, i) => (
              <option key={label} value={i + 1}>{label}</option>
            ))}
          </select>
        </ModernFieldShell>

        <ModernFieldShell label="Base period (go-live month)" required>
          <input
            type="month"
            value={baseMonth}
            onChange={(e) => setBaseMonth(e.target.value)}
            className={showErrors && missingBase ? fieldErrorCls : fieldCls}
            aria-label="Base period go-live month"
            aria-required="true"
            aria-invalid={(showErrors && missingBase) || undefined}
            aria-describedby={showErrors && missingBase ? 'base-period-error' : undefined}
          />
          <p className="mt-1 text-2xs text-stone-400">
            The first month you&apos;ll post transactions into. Earlier months are generated closed.
          </p>
          {showErrors && missingBase && (
            <p id="base-period-error" className="text-2xs text-destructive">A base period is required.</p>
          )}
        </ModernFieldShell>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={setup.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-stone-950 shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {setup.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
          {setup.isPending ? 'Setting up…' : 'Set Up Calendar'}
        </button>
      </div>
    </div>
  );
}
