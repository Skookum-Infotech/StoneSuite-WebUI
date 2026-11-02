import { cn } from '@/lib/utils';
import { totalCount } from '@/lib/vendorTransactions';
import type { VendorTransactionsOverview } from '@/types/vendorTransactions';

const CHIP_BASE =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CHIP_IDLE = 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50';
const CHIP_ACTIVE = 'border-[#001219] bg-[#001219] text-white';

function Chip({
  label, count, active, onSelect,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={count === undefined ? `Show ${label}` : `Show ${label}, ${count.toLocaleString()} documents`}
      className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_IDLE)}
    >
      {label}
      {count !== undefined && (
        <span className={cn('rounded-full px-1.5 text-2xs tabular-nums', active ? 'bg-white/20' : 'bg-stone-100 text-stone-500')}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

/**
 * One chip per readable document type with its count, plus "All". Selecting a
 * chip is the type filter; the selected one is `aria-pressed`. Scrolls
 * sideways on a phone rather than wrapping into a tall block.
 */
export function VendorTransactionTypeBadges({
  overview, selected, onSelect,
}: {
  overview: VendorTransactionsOverview;
  selected: string;
  onSelect: (type: string) => void;
}) {
  const countOf = (type: string) => overview.counts.find((c) => c.type === type)?.count;
  return (
    <div role="group" aria-label="Filter by document type" className="flex gap-2 overflow-x-auto pb-1 modal-scrollbar">
      <Chip label="All" count={totalCount(overview.counts)} active={selected === ''} onSelect={() => onSelect('')} />
      {overview.types.map((t) => (
        <Chip
          key={t.type}
          label={t.label}
          count={countOf(t.type) ?? 0}
          active={selected === t.type}
          onSelect={() => onSelect(selected === t.type ? '' : t.type)}
        />
      ))}
    </div>
  );
}
