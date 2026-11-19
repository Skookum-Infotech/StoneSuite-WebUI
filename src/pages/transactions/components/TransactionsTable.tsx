import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/recentRecordRoute';
import { formatAmount, rowHeadline, rowHref, rowSubline } from '@/lib/myTransactions';
import type { TransactionRow } from '@/types/myTransactions';
import { RoleBadge, StatusBadge, TypeBadge } from './TransactionBadges';

const HEAD_CLS = 'whitespace-nowrap px-4 py-3 text-left type-th';

/**
 * The wide-screen layout (lg and up): one row per record; each opens its
 * record's detail page. Narrower screens use TransactionCards instead.
 */
export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto modal-scrollbar">
      <table className="w-full min-w-[820px] border-collapse type-cell">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50/40">
            <th className={HEAD_CLS}>Record</th>
            <th className={HEAD_CLS}>Type</th>
            <th className={HEAD_CLS}>Customer / Vendor</th>
            <th className={HEAD_CLS}>Status</th>
            <th className={cn(HEAD_CLS, 'text-right')}>Amount</th>
            <th className={HEAD_CLS}>My activity</th>
            <th className={cn(HEAD_CLS, 'text-right')}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const subline = rowSubline(row);
            const href = rowHref(row);
            return (
              <tr
                key={`${row.type}:${row.id}`}
                onClick={() => navigate(href)}
                className={cn(
                  'cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50/60',
                  idx === rows.length - 1 && 'border-b-0',
                )}
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={href}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${row.typeLabel} ${rowHeadline(row)}`}
                    className="rounded hover:text-ink-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring type-record-id"
                  >
                    {rowHeadline(row)}
                  </Link>
                  {subline && <p className="mt-0.5 max-w-[240px] truncate text-ink-muted">{subline}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5"><TypeBadge row={row} /></td>
                <td className="max-w-[220px] px-4 py-2.5">
                  <span className="block truncate font-semibold text-ink-strong">{row.account || '—'}</span>
                </td>
                <td className="px-4 py-2.5"><StatusBadge row={row} /></td>
                <td className="type-cell-strong whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {formatAmount(row.amount)}
                </td>
                <td className="px-4 py-2.5"><RoleBadge role={row.role} /></td>
                <td className="type-cell whitespace-nowrap px-4 py-2.5 text-right">
                  <time dateTime={row.updatedAt} title={new Date(row.updatedAt).toLocaleString()}>
                    {relativeTime(row.updatedAt)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
