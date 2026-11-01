import type { CustomerTransactionSummary as Summary } from '@/types/customerTransactions';
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
      sub: plural(s.openInvoiceCount ?? 0, 'open invoice'),
    });
  }
  if (s.overdueBalance !== null) {
    const late = s.overdueBalance > 0;
    tiles.push({
      key: 'overdue', label: 'Overdue', value: moneyOrDash(s.overdueBalance),
      sub: plural(s.overdueInvoiceCount ?? 0, 'overdue invoice'),
      tone: late ? 'text-red-600' : undefined,
    });
  }
  if (s.unappliedCredits !== null) {
    tiles.push({ key: 'credits', label: 'Unapplied credits', value: moneyOrDash(s.unappliedCredits), sub: 'payments and credit memos' });
  }
  if (s.billed12m !== null) {
    tiles.push({ key: 'billed', label: 'Billed (12 mo)', value: moneyOrDash(s.billed12m), sub: 'invoiced, last 12 months' });
  }
  if (s.paid12m !== null) {
    tiles.push({ key: 'paid', label: 'Paid (12 mo)', value: moneyOrDash(s.paid12m), sub: 'received, last 12 months' });
  }
  if (s.lastActivityAt) {
    tiles.push({ key: 'last', label: 'Last activity', value: relativeTime(s.lastActivityAt), sub: 'latest update on any record' });
  }
  return tiles;
}

/**
 * The customer's AR summary tiles. A figure the caller cannot read is hidden
 * rather than shown as zero; `scopeLimited` adds a note that the figures cover
 * only the records the caller can see.
 */
export function CustomerTransactionSummary({
  summary, scopeLimited,
}: {
  summary: Summary;
  scopeLimited: boolean;
}) {
  const tiles = buildTiles(summary);
  if (tiles.length === 0 && !scopeLimited) return null;
  return (
    <section aria-label="Customer account summary" className="space-y-2">
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <div key={t.key} className="min-w-0 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm sm:px-4">
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
