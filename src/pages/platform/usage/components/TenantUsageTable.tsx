import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ALL_STATUSES,
  defaultDir,
  filterUsageRows,
  sortUsageRows,
  statusOptions,
  type SortDir,
  type UsageSortKey,
} from '@/lib/tenantUsageTable';
import { formatBytes, formatComputeHours } from '@/lib/usageFormat';
import { SEVERITY_LABEL } from '@/lib/usageWatchlist';
import type { TenantUsageRow, UsagePeriod } from '@/types/platformUsage';
import { SeverityDot } from './SeverityDot';
import { TenantAvatar } from './TenantAvatar';
import { TenantUsageRowView } from './TenantUsageRowView';
import { usageDetailPath } from './usagePaths';

const COLUMNS: { key: UsageSortKey | null; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Tenant' },
  { key: null, label: 'Status' },
  { key: 'users', label: 'Users' },
  { key: 'compute', label: 'Compute', numeric: true },
  { key: 'db', label: 'Database', numeric: true },
  { key: 'r2', label: 'R2', numeric: true },
  { key: 'ai', label: 'AI tokens', numeric: true },
  { key: 'errors', label: 'Errors', numeric: true },
  { key: null, label: 'Compute trend' },
  { key: 'alert', label: 'Alert' },
];

const CONTROL_CLASS = 'rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm';

function MobileCard({ row }: { row: TenantUsageRow }) {
  const label = row.topSeverity ? `${SEVERITY_LABEL[row.topSeverity]} alert` : 'No open alerts';
  return (
    <Link
      to={usageDetailPath(row.tenantId)}
      aria-label={`Open usage for ${row.displayName}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-stone-200 p-3 hover:bg-stone-50"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <TenantAvatar name={row.displayName} status={row.status} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-stone-900">{row.displayName}</span>
          <span className="block text-xs text-stone-500">{row.status}</span>
        </span>
      </span>
      <SeverityDot severity={row.topSeverity} label={label} />
      <dl className="col-span-2 grid grid-cols-3 gap-2 text-sm">
        {[
          ['Compute', row.computeHours === null ? '—' : formatComputeHours(row.computeHours)],
          ['Database', row.dbBytes === null ? '—' : formatBytes(row.dbBytes)],
          ['R2', row.r2Bytes === null ? '—' : formatBytes(row.r2Bytes)],
        ].map(([dt, dd]) => (
          <div key={dt}>
            <dt className="text-2xs uppercase tracking-wide text-stone-500">{dt}</dt>
            <dd className="font-semibold tabular-nums">{dd}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

/** Every tenant with its usage for the period: searchable, filterable by status, sortable by column. */
export function TenantUsageTable({ rows, period }: { rows: TenantUsageRow[]; period: UsagePeriod }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL_STATUSES);
  const [sortKey, setSortKey] = useState<UsageSortKey>('compute');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const visible = sortUsageRows(filterUsageRows(rows, query, status), sortKey, sortDir);

  const sortBy = (key: UsageSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(defaultDir(key));
    }
  };

  const empty = <p className="py-8 text-center text-sm text-stone-500">No tenants match your search.</p>;

  return (
    <section aria-labelledby="tenants-heading" className="rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="tenants-heading" className="text-sm font-bold text-stone-950">
          All tenants
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tenants…"
            aria-label="Search tenants"
            className={cn(CONTROL_CLASS, 'min-w-0 flex-1 sm:w-56 sm:flex-none')}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={CONTROL_CLASS}>
            <option value={ALL_STATUSES}>All statuses</option>
            {statusOptions(rows).map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200">
              {COLUMNS.map((c) => {
                const active = c.key !== null && c.key === sortKey;
                const label = c.key === null && c.label === 'Compute trend' ? `${period} compute` : c.label;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'whitespace-nowrap px-2.5 py-2 text-2xs font-semibold uppercase tracking-wide text-stone-500',
                      c.numeric ? 'text-right' : 'text-left',
                    )}
                  >
                    {c.key === null ? (
                      label
                    ) : (
                      <button
                        type="button"
                        onClick={() => sortBy(c.key as UsageSortKey)}
                        aria-label={`Sort by ${c.label}`}
                        className={cn('uppercase tracking-wide hover:text-stone-900', active && 'text-stone-900')}
                      >
                        {label}
                        {active && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <TenantUsageRowView key={r.tenantId} row={r} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && empty}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {visible.map((r) => (
          <MobileCard key={r.tenantId} row={r} />
        ))}
        {visible.length === 0 && empty}
      </div>

      <p className="pt-3 text-center text-xs text-stone-500">
        Showing {visible.length} of {rows.length} tenants
      </p>
    </section>
  );
}
