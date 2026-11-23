import { Link } from 'react-router-dom';
import { recordRoute } from '@/lib/recentRecordRoute';
import { formatInboxAmount, signOffLabel, waitingDays } from '@/lib/approvalInbox';
import type { ApprovalInboxItem } from '@/types/approvalInbox';
import { AgeBadge } from './AgeBadge';

// One semantic table. Below `md` each row is restyled into a stacked card (the
// cell's data-label supplies its caption), so a phone gets no horizontal scroll.
const CELL = 'block px-4 py-1 before:mr-2 before:text-2xs before:font-semibold before:uppercase before:text-stone-400 before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3 md:before:content-none';
const HEAD = 'px-4 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-stone-500';

export function ApprovalInboxTable({ items, caption }: { items: ApprovalInboxItem[]; caption: string }) {
  const now = new Date();
  return (
    <table className="block w-full text-sm md:table">
      <caption className="sr-only">{caption}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-stone-200">
          {['Record', 'Party', 'Amount', 'Owner', 'Waiting', 'Sign-off', 'Action'].map((h) => (
            <th key={h} scope="col" className={HEAD}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {items.map((item) => {
          const href = recordRoute(item.domain, item.routeModule, item.recordUuid);
          const amount = formatInboxAmount(item.amount, item.currency);
          return (
            <tr
              key={`${item.module}:${item.recordUuid}`}
              className="mb-3 block rounded-xl border border-stone-200 bg-white py-2 md:mb-0 md:table-row md:rounded-none md:border-0 md:border-b md:py-0"
            >
              <td className={CELL} data-label="Record">
                <Link to={href} className="font-semibold text-stone-900 underline-offset-2 hover:underline">
                  {item.label} {item.number}
                </Link>
              </td>
              <td className={CELL} data-label="Party">{item.partyName ?? ''}</td>
              <td className={CELL} data-label={amount ? 'Amount' : ''}>{amount ?? ''}</td>
              <td className={CELL} data-label="Owner">{item.ownerName ?? ''}</td>
              <td className={CELL} data-label="Waiting"><AgeBadge days={waitingDays(item.waitingSince, now)} /></td>
              <td className={CELL} data-label="Sign-off">{signOffLabel(item)}</td>
              <td className={CELL} data-label="">
                {item.canApprove ? (
                  <Link
                    to={href}
                    aria-label={`Review ${item.label} ${item.number}`}
                    className="inline-flex h-8 items-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                  >
                    Review
                  </Link>
                ) : (
                  <span className="text-xs text-stone-500">View only</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
