import { Link } from 'react-router-dom';
import { recordRoute } from '@/lib/recentRecordRoute';
import { dateOrDash, moneyOrDash } from '@/lib/customerTransactions';
import { balanceLabel } from '@/lib/vendorTransactions';
import type { VendorTransactionRow } from '@/types/vendorTransactions';
import { StatusBadge, TypeBadge } from '@/pages/transactions/components/TransactionBadges';
import { OverdueBadge } from '@/pages/crm/customer/components/transactions/OverdueBadge';

/** The narrow-screen layout (below lg): each transaction is a tappable card. */
export function VendorTransactionCards({ rows }: { rows: VendorTransactionRow[] }) {
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
                <p className="min-w-0 truncate font-mono text-xs font-semibold text-stone-800">{row.number || '—'}</p>
                <TypeBadge row={row} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge row={row} />
                {row.isOverdue && <OverdueBadge />}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-500">Date</dt>
                  <dd className="font-semibold text-stone-800">{dateOrDash(row.date)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-500">Due</dt>
                  <dd className="font-semibold text-stone-800">{dateOrDash(row.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-500">Amount</dt>
                  <dd className="font-bold tabular-nums text-stone-900">{moneyOrDash(row.amount)}</dd>
                </div>
                {row.balance !== null && (
                  <div className="text-right">
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-stone-500">{balanceNote || 'Balance'}</dt>
                    <dd className="font-bold tabular-nums text-stone-900">{moneyOrDash(row.balance)}</dd>
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
