import { formatBytes, formatTokenCount } from '@/lib/usageFormat';
import { formatTenantDate } from '@/lib/tenantDisplay';
import type { TableSize } from '@/types/platformUsage';
import { UsageBar } from './UsageBar';

/** The tenant database's largest tables (size includes indexes and TOAST). */
export function TopTablesCard({ tables, measuredAt }: { tables: TableSize[]; measuredAt: string | null }) {
  const largest = tables[0]?.totalBytes ?? 0;
  return (
    <section aria-labelledby="tables-heading" className="min-w-0 rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tables-heading" className="text-sm font-bold text-stone-950">
          Largest tables
        </h2>
        <span className="text-xs text-stone-500">
          {measuredAt ? `Database · measured ${formatTenantDate(measuredAt)}` : 'Not measured yet'}
        </span>
      </div>
      {tables.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">No table sizes yet.</p>
      ) : (
        <ul className="flex flex-col">
          {tables.map((tb) => (
            <li key={tb.tableName} className="flex flex-col gap-1.5 border-t border-stone-100 py-2 first:border-t-0">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-mono text-xs text-stone-800">{tb.tableName}</span>
                <span className="shrink-0 tabular-nums">
                  {formatBytes(tb.totalBytes)}
                  <span className="text-xs text-stone-500"> · {formatTokenCount(tb.rowEstimate)} rows</span>
                </span>
              </span>
              <UsageBar value={tb.totalBytes} max={largest} label={`${tb.tableName} size`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
