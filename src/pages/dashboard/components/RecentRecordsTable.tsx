import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatBreadcrumbSegment } from '@/lib/breadcrumb';
import { recordRoute, relativeTime } from '@/lib/recentRecordRoute';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { RecentRecord } from '@/types/dashboardData';

// Badge color per module, grouped by the domain the module lives in (crm
// stages reuse the app's existing workflow-* design tokens -- see
// index.css -- so a Lead/Prospect/Customer badge here matches every other
// place those stages render). Sales and Purchases have no existing shared
// token, so each module gets its own standard Tailwind pair, distinct
// within its domain.
const MODULE_META: Record<string, { bg: string; text: string }> = {
  lead: { bg: 'bg-workflow-lead-bg', text: 'text-workflow-lead-text' },
  prospect: { bg: 'bg-workflow-prospect-bg', text: 'text-workflow-prospect-text' },
  customer: { bg: 'bg-workflow-customer-bg', text: 'text-workflow-customer-text' },
  quote: { bg: 'bg-sky-100', text: 'text-sky-700' },
  estimate: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  sales_order: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  invoice: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  payment: { bg: 'bg-green-100', text: 'text-green-700' },
  credit_memo: { bg: 'bg-rose-100', text: 'text-rose-700' },
  refund: { bg: 'bg-orange-100', text: 'text-orange-700' },
  requisition: { bg: 'bg-amber-100', text: 'text-amber-700' },
  purchase_order: { bg: 'bg-violet-100', text: 'text-violet-700' },
  item_receipt: { bg: 'bg-slate-100', text: 'text-slate-700' },
  vendor_bill: { bg: 'bg-teal-100', text: 'text-teal-700' },
  vendor_payment: { bg: 'bg-lime-100', text: 'text-lime-700' },
  vendor_credit: { bg: 'bg-pink-100', text: 'text-pink-700' },
  expense: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
};
const FALLBACK_META = { bg: 'bg-stone-100', text: 'text-stone-700' };

function currency(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function RecentRecordsTable({
  records,
  isLoading,
  isError,
  hasMore = false,
}: {
  records: RecentRecord[] | undefined;
  isLoading: boolean;
  isError: boolean;
  hasMore?: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-card p-[18px] shadow-sm">
        <Spinner label="Loading recent records…" />
      </div>
    );
  }

  if (isError || !records) {
    return (
      <div className="rounded-xl border border-stone-200 bg-card p-[18px] shadow-sm">
        <ErrorNote>Couldn&apos;t load recent records.</ErrorNote>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-[18px] text-center text-sm text-stone-400">
        No recent activity to show.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-card shadow-sm">
      <div className="flex items-baseline justify-between gap-2.5 px-[19px] pb-[13px] pt-[17px]">
        <span className="text-[13.5px] font-bold text-stone-950">Recent records</span>
        <span className="text-[11.5px] text-stone-500">across CRM, Sales &amp; Purchases</span>
      </div>

      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full min-w-[660px] text-left">
          <thead className="border-t border-b border-stone-200 bg-table-header">
            <tr>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Type</th>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Record</th>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Account</th>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Value</th>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
              <th className="whitespace-nowrap px-[19px] py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.map((r) => {
              const meta = MODULE_META[r.module] ?? FALLBACK_META;
              const typeLabel = formatBreadcrumbSegment(r.module);
              return (
                <tr key={r.id} className="transition-colors duration-150 hover:bg-stone-50">
                  <td className="whitespace-nowrap px-[19px] py-3">
                    <span className={cn('inline-block rounded-full px-2.5 py-1 text-2xs font-bold', meta.bg, meta.text)}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-[19px] py-3 font-mono text-xs text-stone-500">
                    <button
                      type="button"
                      onClick={() => navigate(recordRoute(r.domain, r.module, r.id))}
                      aria-label={`View ${typeLabel} ${r.recordNumber}${r.account ? ` for ${r.account}` : ''}`}
                      className="rounded text-left hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {r.recordNumber}
                    </button>
                  </td>
                  <td className="px-[19px] py-3 text-xs text-stone-950">{r.account ?? '—'}</td>
                  <td className="whitespace-nowrap px-[19px] py-3 text-right text-xs font-semibold text-stone-950 tabular-nums">
                    {currency(r.value)}
                  </td>
                  <td className="whitespace-nowrap px-[19px] py-3">
                    <span className="text-xs font-semibold text-stone-950">{r.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-[19px] py-3 text-right font-mono text-2xs text-stone-500">
                    <time dateTime={r.updatedAt} title={new Date(r.updatedAt).toLocaleString()}>
                      {relativeTime(r.updatedAt)}
                    </time>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-[19px] pb-3">
          <p className="pt-2 text-2xs font-medium text-stone-400">More records available — narrow the range to see fewer.</p>
        </div>
      )}
    </div>
  );
}
