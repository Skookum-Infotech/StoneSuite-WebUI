import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { recordRoute } from '@/lib/recentRecordRoute';
import { balanceLabel, dateOrDash, moneyOrDash } from '@/lib/customerTransactions';
import type { CustomerTransactionRow } from '@/types/customerTransactions';
import { StatusBadge, TypeBadge } from '@/pages/transactions/components/TransactionBadges';
import { OverdueBadge } from './OverdueBadge';

const HEAD_CLS = 'whitespace-nowrap px-4 py-3 text-left type-th';

/** The wide-screen layout (lg and up): one row per transaction; each opens its record. */
export function CustomerTransactionsTable({ rows }: { rows: CustomerTransactionRow[] }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto modal-scrollbar">
      <table className="w-full min-w-[820px] border-collapse type-cell">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50/40">
            <th className={HEAD_CLS}>Date</th>
            <th className={HEAD_CLS}>Type</th>
            <th className={HEAD_CLS}>Number</th>
            <th className={HEAD_CLS}>Status</th>
            <th className={HEAD_CLS}>Due</th>
            <th className={cn(HEAD_CLS, 'text-right')}>Amount</th>
            <th className={cn(HEAD_CLS, 'text-right')}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const href = recordRoute(row.domain, row.module, row.id);
            const balanceNote = balanceLabel(row);
            return (
              <tr
                key={`${row.type}:${row.id}`}
                onClick={() => navigate(href)}
                className={cn(
                  'cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50/60',
                  idx === rows.length - 1 && 'border-b-0',
                )}
              >
                <td className="type-cell whitespace-nowrap px-4 py-2.5">{dateOrDash(row.date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5"><TypeBadge row={row} /></td>
                <td className="px-4 py-2.5">
                  <Link
                    to={href}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${row.typeLabel} ${row.number || row.id}`}
                    className="rounded hover:text-ink-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring type-record-id"
                  >
                    {row.number || '—'}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge row={row} />
                    {row.isOverdue && <OverdueBadge />}
                  </div>
                </td>
                <td className="type-cell whitespace-nowrap px-4 py-2.5">{dateOrDash(row.dueDate)}</td>
                <td className="type-cell-strong whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {moneyOrDash(row.amount)}
                </td>
                <td className="type-cell whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {row.balance === null ? '—' : (
                    <>
                      <span className="font-bold">{moneyOrDash(row.balance)}</span>
                      {balanceNote && <span className="block type-subline">{balanceNote}</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
