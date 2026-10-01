import { cn } from '@/lib/utils';
import {
  DOMAIN_BADGE,
  FALLBACK_DOMAIN_BADGE,
  ROLE_LABELS,
  STATUS_TONE_CLASSES,
  statusTone,
} from '@/lib/myTransactions';
import type { TransactionRow } from '@/types/myTransactions';

// Badges shared by the table (wide screens) and the cards (narrow screens).

/** The record's status, coloured by what the status code means; a dash if none. */
export function StatusBadge({ row }: { row: TransactionRow }) {
  if (!row.status) return <span className="text-stone-400">—</span>;
  const cfg = STATUS_TONE_CLASSES[statusTone(row.statusCode)];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-bold', cfg.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {row.status}
    </span>
  );
}

/** Whether the caller created the record or last updated someone else's. */
export function RoleBadge({ role }: { role: TransactionRow['role'] }) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs font-bold',
        role === 'created' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700',
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

/** The record type, one colour per domain. */
export function TypeBadge({ row }: { row: TransactionRow }) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs font-bold',
        DOMAIN_BADGE[row.domain] ?? FALLBACK_DOMAIN_BADGE,
      )}
    >
      {row.typeLabel}
    </span>
  );
}
