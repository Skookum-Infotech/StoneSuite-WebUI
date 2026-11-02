import type { VendorTransactionSummary as Summary } from '@/types/vendorTransactions';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/recentRecordRoute';
import { moneyOrDash } from '@/lib/customerTransactions';

interface Tile {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

/** The tiles worth showing: a figure the caller cannot read (null) gets no tile at all. */
function buildTiles(s: Summary): Tile[] {
  const tiles: Tile[] = [];
  if (s.openBalance !== null) {
    tiles.push({
      key: 'open', label: 'Open balance', value: moneyOrDash(s.openBalance),
      sub: plural(s.openBillCount ?? 0, 'open bill'),
    });
  }
  if (s.overdueAmount !== null) {
    tiles.push({
      key: 'overdue', label: 'Overdue', value: moneyOrDash(s.overdueAmount),
      sub: plural(s.overdueBillCount ?? 0, 'overdue bill'),
      tone: s.overdueAmount > 0 ? 'text-red-600 dark:text-red-400' : undefined,
    });
  }
  if (s.unappliedCredits !== null) {
    tiles.push({ key: 'credits', label: 'Unapplied credits', value: moneyOrDash(s.unappliedCredits), sub: 'payments and vendor credits' });
  }
  if (s.paid12m !== null) {
    tiles.push({ key: 'paid', label: 'Paid (12 mo)', value: moneyOrDash(s.paid12m), sub: 'paid to vendor, last 12 months' });
  }
  if (s.lastActivityAt) {
    tiles.push({ key: 'last', label: 'Last activity', value: relativeTime(s.lastActivityAt), sub: 'latest update on any record' });
  }
  return tiles;
}

/**
 * The vendor's payables summary tiles. A figure the caller cannot read is
 * hidden rather than shown as zero; `scopeLimited` adds a note that the
 * figures cover only the records the caller can see.
 */
export function VendorTransactionSummary({
  summary, scopeLimited,
}: {
  summary: Summary;
  scopeLimited: boolean;
}) {
  const tiles = buildTiles(summary);
  if (tiles.length === 0 && !scopeLimited) return null;
  return (
    <section aria-label="Vendor account summary" className="space-y-2">
      {tiles.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.key} className="min-w-0 flex-1 basis-36 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm sm:px-4">
              <p className="text-xs font-semibold leading-tight text-stone-500">{t.label}</p>
              <p className={cn('mt-1 truncate text-base font-bold tabular-nums text-stone-900', t.tone)}>{t.value}</p>
              <p className="mt-0.5 truncate text-2xs text-stone-500">{t.sub}</p>
            </div>
          ))}
        </div>
      )}
      {scopeLimited && <p className="text-2xs text-stone-500">Based on records you can see.</p>}
    </section>
  );
}
