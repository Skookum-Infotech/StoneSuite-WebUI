import { rankTopCustomers } from '@/lib/dashboardWidgets';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { CustomerValue } from '../mockData';

const LIMIT = 5;

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function TopCustomers({ customers }: { customers: CustomerValue[] }) {
  const ranked = rankTopCustomers(customers, LIMIT);

  return (
    <WidgetCard title="Top customers" subtitle="by value">
      <div className="flex flex-col gap-[13px]">
        {ranked.map((c, i) => (
          <div key={c.id} className="flex items-center gap-[11px]">
            <span className="w-4 shrink-0 text-2xs font-bold text-stone-400 tabular-nums">{i + 1}</span>
            <span className="w-[104px] shrink-0 truncate text-xs font-medium text-stone-950">{c.name}</span>
            <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand-dark" style={{ width: `${c.proportion * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">
              {currency(c.value)}
            </span>
          </div>
        ))}
      </div>
      <MoreHint count={customers.length - LIMIT} label="more customers" />
    </WidgetCard>
  );
}
