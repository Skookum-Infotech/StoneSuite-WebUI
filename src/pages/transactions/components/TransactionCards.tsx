import { Link } from 'react-router-dom';
import { relativeTime } from '@/lib/recentRecordRoute';
import { formatAmount, rowHeadline, rowHref, rowSubline } from '@/lib/myTransactions';
import type { TransactionRow } from '@/types/myTransactions';
import { RoleBadge, StatusBadge, TypeBadge } from './TransactionBadges';

/**
 * The narrow-screen layout (below lg): each record is a tappable card — one
 * column on phones, two on tablets — so nothing needs horizontal scrolling.
 * Wide screens use TransactionsTable instead.
 */
export function TransactionCards({ rows }: { rows: TransactionRow[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
      {rows.map((row) => {
        const subline = rowSubline(row);
        return (
          <li key={`${row.type}:${row.id}`} className="min-w-0">
            <Link
              to={rowHref(row)}
              aria-label={`View ${row.typeLabel} ${rowHeadline(row)}`}
              className="block h-full rounded-xl border border-stone-200 bg-white p-3.5 transition-colors hover:bg-stone-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-stone-800">{rowHeadline(row)}</p>
                  {subline && <p className="mt-0.5 truncate text-xs text-stone-500">{subline}</p>}
                </div>
                <TypeBadge row={row} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge row={row} />
                <RoleBadge role={row.role} />
              </div>

              <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-400">Customer / Vendor</dt>
                  <dd className="truncate font-semibold text-stone-800">{row.account || '—'}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-400">Amount</dt>
                  <dd className="font-bold tabular-nums text-stone-900">{formatAmount(row.amount)}</dd>
                </div>
              </dl>

              <p className="mt-2.5 text-2xs text-stone-400">
                Updated{' '}
                <time dateTime={row.updatedAt} title={new Date(row.updatedAt).toLocaleString()}>
                  {relativeTime(row.updatedAt)}
                </time>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
