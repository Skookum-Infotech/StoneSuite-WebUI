import { cn } from '@/lib/utils';
import { MoreHint } from './MoreHint';
import type { RecentRecord } from '../mockData';

const LIMIT = 6;

function currency(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function RecentRecordsTable({ records }: { records: RecentRecord[] }) {
  const visible = records.slice(0, LIMIT);

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
            {visible.map((r) => (
              <tr key={r.id} className="transition-colors duration-150 hover:bg-stone-50">
                <td className="whitespace-nowrap px-[19px] py-3">
                  <span className={cn('inline-block rounded-full px-2.5 py-1 text-2xs font-bold', r.typeBg, r.typeText)}>
                    {r.type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-[19px] py-3 font-mono text-xs text-stone-500">{r.recordNumber}</td>
                <td className="px-[19px] py-3 text-xs text-stone-950">{r.account}</td>
                <td className="whitespace-nowrap px-[19px] py-3 text-right text-xs font-semibold text-stone-950 tabular-nums">
                  {currency(r.value)}
                </td>
                <td className="whitespace-nowrap px-[19px] py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-950">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.statusColor }} aria-hidden="true" />
                    {r.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-[19px] py-3 text-right font-mono text-2xs text-stone-500">{r.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-[19px] pb-3">
        <MoreHint count={records.length - LIMIT} label="more records" />
      </div>
    </div>
  );
}
