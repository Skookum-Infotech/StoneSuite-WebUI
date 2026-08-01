import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Plus } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { CalendarSetupCard } from './components/CalendarSetupCard';
import { PeriodTreeTable } from './components/PeriodTreeTable';
import { GenerateFiscalYearDialog } from './components/GenerateFiscalYearDialog';

// Finance > Accounting Periods. Renders the one-time calendar setup card
// until accounting-calendar reports configured=true, then the FY -> quarter
// -> month tree. Route-gated on accounting_period:read; :configure and
// :create separately gate the setup form and "Generate Fiscal Year".
export default function AccountingPeriodsPage() {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canConfigure = permsLoading || hasPermission('accounting_period', 'configure');
  const canCreate = permsLoading || hasPermission('accounting_period', 'create');
  const [generateOpen, setGenerateOpen] = useState(false);

  const { data: calendar, isLoading, isError, error } = useQuery({
    queryKey: ['ap-calendar'],
    queryFn: accountingPeriodService.getCalendar,
  });

  const { data: currentPeriod } = useQuery({
    queryKey: ['ap-current-period'],
    queryFn: accountingPeriodService.getCurrentPeriod,
    enabled: Boolean(calendar?.configured),
  });

  // Shares the ['ap-fiscal-years'] cache entry with PeriodTreeTable — React
  // Query dedupes the concurrent identical query, so this is not a second
  // network call. Fetched here too so the Generate dialog can preview the
  // next fiscal year without threading state up from a sibling.
  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['ap-fiscal-years'],
    queryFn: accountingPeriodService.listFiscalYears,
    enabled: Boolean(calendar?.configured),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14 overflow-y-auto modal-scrollbar">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <CalendarClock className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Accounting Periods</h1>
              <p className="text-sm text-stone-500">
                {calendar?.configured && currentPeriod
                  ? `Current period: ${currentPeriod.name}`
                  : 'Fiscal calendar, monthly period open/close, and the audit trail behind every close.'}
              </p>
            </div>
          </div>

          {calendar?.configured && canCreate && (
            <button
              type="button"
              onClick={() => setGenerateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              Generate Fiscal Year
            </button>
          )}
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-stone-100 pt-4">
          {isLoading ? (
            <Spinner label="Loading the fiscal calendar…" />
          ) : isError ? (
            <ErrorNote>{apiErrorMessage(error, 'Failed to load the fiscal calendar.')}</ErrorNote>
          ) : !calendar?.configured ? (
            canConfigure ? (
              <CalendarSetupCard />
            ) : (
              <EmptyState>
                The fiscal calendar has not been set up yet. Ask an administrator with calendar
                setup access to configure it.
              </EmptyState>
            )
          ) : (
            <PeriodTreeTable calendar={calendar} />
          )}
        </div>
      </div>

      {generateOpen && calendar && (
        <GenerateFiscalYearDialog onClose={() => setGenerateOpen(false)} fiscalYears={fiscalYears} calendar={calendar} />
      )}
    </div>
  );
}
