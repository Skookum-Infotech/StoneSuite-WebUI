import { bucketInvoicesByAge, type AgingBucket } from '@/lib/dashboardWidgets';
import { WidgetCard } from './WidgetCard';
import type { OutstandingInvoice } from '../mockData';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const BUCKET_COLOR: Record<AgingBucket['label'], string> = {
  '0-30': '#c2f589',
  '31-60': '#d97706',
  '61-90': '#ea580c',
  '90+': '#dc2626',
};

export function ArOutstanding({ invoices }: { invoices: OutstandingInvoice[] }) {
  const total = invoices.reduce((sum, i) => sum + i.amount, 0);
  const overdue = invoices.filter((i) => i.daysPastDue > 0);
  const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
  const buckets = bucketInvoicesByAge(invoices);
  const maxBucket = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <WidgetCard title="Accounts receivable" subtitle="outstanding invoices">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Total</div>
          <div className="mt-1 text-sm font-bold text-stone-950 tabular-nums sm:text-base lg:text-lg">{currency(total)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Overdue</div>
          <div className="mt-1 text-sm font-bold text-warning tabular-nums sm:text-base lg:text-lg">{currency(overdueTotal)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Count</div>
          <div className="mt-1 text-sm font-bold text-stone-950 tabular-nums sm:text-base lg:text-lg">{overdue.length}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-[9px]">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-[11px]">
            <span className="w-12 shrink-0 text-2xs font-semibold text-stone-500">{b.label}d</span>
            <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(b.amount / maxBucket) * 100}%`, backgroundColor: BUCKET_COLOR[b.label] }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">
              {currency(b.amount)}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
