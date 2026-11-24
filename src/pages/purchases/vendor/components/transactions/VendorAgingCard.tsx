import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { useVendorAging } from '@/hooks/useVendorTransactions';
import { moneyOrDash } from '@/lib/customerTransactions';
import { cn } from '@/lib/utils';

// The server's bucket keys (vendortransactions.Aging*), in its display order.
const BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61+': '61+ days',
};
// Buckets past this many days get the warning tone once they hold money.
const SEVERE_BUCKETS = new Set(['31-60', '61+']);

const GHOST_BTN =
  'rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-stone-50 cursor-pointer';

function plural(n: number): string {
  return `${n.toLocaleString()} bill${n === 1 ? '' : 's'}`;
}

/**
 * The vendor's open bills by days past due. Shows the server's buckets as
 * returned, zeros included; renders nothing when the caller cannot read vendor
 * bills (the server answers with no buckets, not an error).
 */
export function VendorAgingCard({ vendorId }: { vendorId: string }) {
  const aging = useVendorAging(vendorId);

  if (aging.isError) {
    return (
      <section aria-label="Open bills by age" className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <ErrorNote>{apiErrorMessage(aging.error, 'Failed to load open bills by age.')}</ErrorNote>
        <button type="button" onClick={() => void aging.refetch()} className={GHOST_BTN}>Retry</button>
      </section>
    );
  }
  if (aging.isLoading) {
    return (
      <p role="status" className="px-1 text-xs font-semibold text-ink-muted">Loading open bills by age…</p>
    );
  }
  const data = aging.data;
  if (!data || data.buckets === null) return null;

  return (
    <section aria-label="Open bills by age" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-card-title">Open Bills by Age</h3>
        <p className="text-xs font-semibold tabular-nums text-ink">Total open {moneyOrDash(data.total)}</p>
      </div>
      <ul className="flex flex-wrap gap-2 sm:gap-3">
        {data.buckets.map((b) => (
          <li
            key={b.label}
            aria-label={`${BUCKET_LABELS[b.label] ?? b.label}: ${moneyOrDash(b.amount)}, ${plural(b.count)}`}
            className="min-w-0 flex-1 basis-32 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm sm:px-4"
          >
            <p className="text-xs font-semibold leading-tight text-ink-muted">{BUCKET_LABELS[b.label] ?? b.label}</p>
            <p
              className={cn(
                'mt-1 truncate text-base font-bold tabular-nums text-ink-strong',
                SEVERE_BUCKETS.has(b.label) && b.amount > 0 && 'text-danger-ink dark:text-red-400',
              )}
            >
              {moneyOrDash(b.amount)}
            </p>
            <p className="mt-0.5 truncate type-helper">{plural(b.count)}</p>
          </li>
        ))}
      </ul>
      {data.scopeLimited && <p className="type-helper">Based on records you can see.</p>}
    </section>
  );
}
