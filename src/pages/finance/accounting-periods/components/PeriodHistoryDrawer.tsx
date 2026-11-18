import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { lookupService } from '@/services/lookupService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { Spinner } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import type { Period, PeriodHistoryAction } from '@/types/accountingPeriod';

// One row per period per call, for the whole-period close/reopen pair and
// for each of the six granular sub-ledger lock endpoints. Locking is amber
// and unlocking emerald throughout, matching the tree's lock icons.
const ACTION_LABELS: Record<PeriodHistoryAction, string> = {
  generate: 'Generated',
  close: 'Closed',
  reopen: 'Reopened',
  base_setup: 'Calendar setup',
  ap_lock: 'A/P locked',
  ap_unlock: 'A/P unlocked',
  ar_lock: 'A/R locked',
  ar_unlock: 'A/R unlocked',
  gl_lock: 'G/L locked',
  gl_unlock: 'G/L unlocked',
};

const ACTION_COLORS: Record<PeriodHistoryAction, string> = {
  generate: 'bg-sky-100 text-sky-700',
  close: 'bg-amber-100 text-amber-700',
  reopen: 'bg-emerald-100 text-emerald-700',
  base_setup: 'bg-violet-100 text-violet-700',
  ap_lock: 'bg-amber-50 text-amber-700',
  ap_unlock: 'bg-emerald-50 text-emerald-700',
  ar_lock: 'bg-amber-50 text-amber-700',
  ar_unlock: 'bg-emerald-50 text-emerald-700',
  gl_lock: 'bg-amber-50 text-amber-700',
  gl_unlock: 'bg-emerald-50 text-emerald-700',
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
            <h2 id="period-history-drawer-title" className="type-dialog-title">History</h2>
            <p className="mt-0.5 type-helper">{period.fiscalYearName} · {period.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-muted transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="modal-scrollbar flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <Spinner label="Loading history…" />
          ) : isError ? (
            <p className="type-error">{apiErrorMessage(error, 'Failed to load history.')}</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center italic type-helper">No history recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg border border-stone-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 type-pill', ACTION_COLORS[e.action] ?? 'bg-stone-100 text-ink')}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="whitespace-nowrap type-subline">{new Date(e.at).toLocaleString()}</span>
                  </div>
                  {(e.fromStatus || e.toStatus) && (
                    <p className="mt-1.5 text-xs text-ink">
                      {e.fromStatus && <span className="text-ink-muted">{e.fromStatus}</span>}
                      {e.fromStatus && e.toStatus && <span className="mx-1.5 text-ink-muted">→</span>}
                      {e.toStatus && <span className="font-medium text-ink-strong">{e.toStatus}</span>}
                    </p>
                  )}
                  {e.note && <p className="mt-1.5 italic type-helper">&ldquo;{e.note}&rdquo;</p>}
                  <p className="mt-1.5 type-helper">
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
