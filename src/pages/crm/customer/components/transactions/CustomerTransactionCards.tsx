import { Link } from 'react-router-dom';
import { recordRoute } from '@/lib/recentRecordRoute';
import { balanceLabel, dateOrDash, moneyOrDash } from '@/lib/customerTransactions';
import type { CustomerTransactionRow } from '@/types/customerTransactions';
import { StatusBadge, TypeBadge } from '@/pages/transactions/components/TransactionBadges';
import { OverdueBadge } from './OverdueBadge';

/** The narrow-screen layout (below lg): each transaction is a tappable card. */
export function CustomerTransactionCards({ rows }: { rows: CustomerTransactionRow[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
      {rows.map((row) => {
        const balanceNote = balanceLabel(row);
        return (
          <li key={`${row.type}:${row.id}`} className="min-w-0">
            <Link
              to={recordRoute(row.domain, row.module, row.id)}
              aria-label={`View ${row.typeLabel} ${row.number || row.id}`}
              className="block h-full rounded-xl border border-stone-200 bg-white p-3.5 transition-colors hover:bg-stone-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate type-record-id">{row.number || '—'}</p>
                <TypeBadge row={row} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge row={row} />
                {row.isOverdue && <OverdueBadge />}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="type-overline">Date</dt>
                  <dd className="font-semibold text-ink-strong">{dateOrDash(row.date)}</dd>
                </div>
                <div className="text-right">
                  <dt className="type-overline">Due</dt>
                  <dd className="font-semibold text-ink-strong">{dateOrDash(row.dueDate)}</dd>
                </div>
                <div>
                  <dt className="type-overline">Amount</dt>
                  <dd className="font-bold tabular-nums text-ink-strong">{moneyOrDash(row.amount)}</dd>
                </div>
                {row.balance !== null && (
                  <div className="text-right">
                    <dt className="type-overline">{balanceNote || 'Balance'}</dt>
                    <dd className="font-bold tabular-nums text-ink-strong">{moneyOrDash(row.balance)}</dd>
                  </div>
                )}
              </dl>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
