import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { lookupService } from '@/services/lookupService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { Spinner } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import type { Period } from '@/types/accountingPeriod';

const ACTION_LABELS: Record<string, string> = {
  generate: 'Generated',
  close: 'Closed',
  reopen: 'Reopened',
  base_setup: 'Calendar setup',
};

const ACTION_COLORS: Record<string, string> = {
  generate: 'bg-sky-100 text-sky-700',
  close: 'bg-amber-100 text-amber-700',
  reopen: 'bg-emerald-100 text-emerald-700',
  base_setup: 'bg-violet-100 text-violet-700',
};

// One period's audit trail, newest first. `by` is an employee id, not a
// name — resolved through the same lookupService employees list every other
// audit view in this repo uses (AccountHistoryTab, JournalEntryAuditTab).
export function PeriodHistoryDrawer({ period, onClose }: { period: Period; onClose: () => void }) {
  const contentRef = useModalDialog(onClose);

  const { data: entries = [], isLoading, isError, error } = useQuery({
    queryKey: ['ap-period-history', period.id],
    queryFn: () => accountingPeriodService.getPeriodHistory(period.id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });
  const employeeNames = new Map((lookups?.employees ?? []).map((e) => [String(e.id), e.name]));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-history-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3.5">
          <div>
            <h2 id="period-history-drawer-title" className="text-sm font-bold text-stone-900">History</h2>
            <p className="mt-0.5 text-2xs text-stone-400">{period.fiscalYearName} · {period.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="modal-scrollbar flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <Spinner label="Loading history…" />
          ) : isError ? (
            <p className="text-xs text-destructive">{apiErrorMessage(error, 'Failed to load history.')}</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-stone-400">No history recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg border border-stone-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold', ACTION_COLORS[e.action] ?? 'bg-stone-100 text-stone-600')}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="whitespace-nowrap text-2xs text-stone-400">{new Date(e.at).toLocaleString()}</span>
                  </div>
                  {(e.fromStatus || e.toStatus) && (
                    <p className="mt-1.5 text-xs text-stone-600">
                      {e.fromStatus && <span className="text-stone-400">{e.fromStatus}</span>}
                      {e.fromStatus && e.toStatus && <span className="mx-1.5 text-stone-300">→</span>}
                      {e.toStatus && <span className="font-medium text-stone-800">{e.toStatus}</span>}
                    </p>
                  )}
                  {e.note && <p className="mt-1.5 text-xs italic text-stone-500">&ldquo;{e.note}&rdquo;</p>}
                  <p className="mt-1.5 text-2xs text-stone-400">
                    {e.by ? employeeNames.get(String(e.by)) ?? 'system' : 'system'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
