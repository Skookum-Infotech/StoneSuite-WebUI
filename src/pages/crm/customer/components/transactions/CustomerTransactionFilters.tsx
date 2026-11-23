import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { isFiltered, statusOptions } from '@/lib/customerTransactions';
import type {
  CustomerTransactionFilters as Filters,
  CustomerTransactionsOverview,
} from '@/types/customerTransactions';

const SEARCH_DEBOUNCE_MS = 300;
const SELECT_CLS =
  'h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer';

/**
 * Type (with counts), status (once a type is chosen), date range, "open items
 * only" and a debounced number search. Controlled by the URL-backed `filters`;
 * `onChange` receives a patch and the container resets the page.
 */
export function CustomerTransactionFilters({
  filters, overview, onChange, onClear,
}: {
  filters: Filters;
  overview: CustomerTransactionsOverview;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  // The last search value this component wrote to (or read from) the URL, so an
  // external change (Clear, back button) resets the box without echoing typing.
  const synced = useRef(filters.q);

  useEffect(() => {
    if (debounced === synced.current) return;
    synced.current = debounced;
    onChange({ q: debounced });
  }, [debounced, onChange]);

  useEffect(() => {
    if (filters.q === synced.current) return;
    synced.current = filters.q;
    setSearch(filters.q);
  }, [filters.q]);

  const statuses = statusOptions(overview.counts, filters.type);
  const countOf = (type: string) => overview.counts.find((c) => c.type === type)?.count;

  return (
    <div className="flex flex-col gap-2 border-b border-stone-100 bg-stone-50/60 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            aria-label="Search by document number"
            placeholder="Search by number…"
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-stone-200 bg-white pl-8.5 pr-3 text-xs text-stone-900 placeholder:text-stone-500 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
        <Select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className={SELECT_CLS}
        >
          <option value="">All types</option>
          {overview.types.map((t) => {
            const n = countOf(t.type);
            return <option key={t.type} value={t.type}>{n === undefined ? t.label : `${t.label} (${n})`}</option>;
          })}
        </Select>
        {filters.type !== '' && (
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className={SELECT_CLS}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.code} value={s.code}>{`${s.label} (${s.count})`}</option>
            ))}
          </Select>
        )}
        <DatePicker label="From date" value={filters.from} onChange={(from) => onChange({ from })} />
        <DatePicker label="To date" value={filters.to} minDate={filters.from || undefined} onChange={(to) => onChange({ to })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-600">
          <Switch
            checked={filters.open}
            onCheckedChange={(open) => onChange({ open })}
            aria-label="Open items only"
          />
          Open items only
        </label>
        {isFiltered(filters) && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
