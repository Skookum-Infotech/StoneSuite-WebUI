import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_FILTER_OPTIONS, groupTypesByDomain } from '@/lib/myTransactions';
import type { TransactionRoleFilter, TransactionType } from '@/types/myTransactions';

const ALL_TYPES_LABEL = 'All record types';

function TypeMenu({
  types, value, onChange,
}: {
  types: TransactionType[]; value: string; onChange: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupTypesByDomain(types), [types]);
  const current = types.find((t) => t.type === value)?.label ?? ALL_TYPES_LABEL;

  // Close on an outside click or Escape, like the app's other popovers.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (type: string) => {
    onChange(type);
    setOpen(false);
  };

  return (
    // Full width when the filters stack (below lg), so the menu below can span
    // the card instead of overflowing a phone's edge.
    <div ref={rootRef} className="relative w-full lg:w-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by record type"
        className="flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50 cursor-pointer lg:w-auto lg:justify-start"
      >
        {current}
        <ChevronDown className="size-3.5 text-stone-400" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Record types"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1.5 shadow-lg modal-scrollbar lg:inset-x-auto lg:right-0 lg:max-h-80 lg:w-56"
        >
          <TypeOption label={ALL_TYPES_LABEL} selected={value === ''} onPick={() => pick('')} />
          {groups.map((g) => (
            <div key={g.domain} role="group" aria-label={g.label}>
              <p className="px-3.5 pb-1 pt-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-400">{g.label}</p>
              {g.types.map((t) => (
                <TypeOption key={t.type} label={t.label} selected={value === t.type} onPick={() => pick(t.type)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeOption({ label, selected, onPick }: { label: string; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs font-semibold transition-colors cursor-pointer',
        selected ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50',
      )}
    >
      {label}
      {selected && <Check className="size-3.5 text-stone-500" />}
    </button>
  );
}

/** Search box, "created / updated" segmented control and record-type menu. */
export function TransactionFilters({
  search, onSearch, role, onRole, types, type, onType,
}: {
  search: string;
  onSearch: (value: string) => void;
  role: TransactionRoleFilter;
  onRole: (role: TransactionRoleFilter) => void;
  types: TransactionType[];
  type: string;
  onType: (type: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-stone-100 bg-stone-50/60 px-3 py-3 sm:px-4 sm:py-3.5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          aria-label="Search your transactions"
          placeholder="Search by reference, name, or customer/vendor…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9 w-full rounded-xl border border-stone-200 bg-white pl-8.5 pr-3 text-xs text-stone-900 transition placeholder:text-stone-400 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>

      {/* Three equal columns that may wrap to two lines on a narrow phone; one row from lg. */}
      <div role="group" aria-label="Filter by my activity" className="grid grid-cols-3 rounded-xl border border-stone-200 bg-white p-0.5 lg:flex">
        {ROLE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={role === opt.value}
            onClick={() => onRole(opt.value)}
            className={cn(
              'min-h-8 rounded-[10px] px-2 py-1 text-center text-xs font-semibold leading-tight transition-colors cursor-pointer lg:whitespace-nowrap lg:px-3',
              role === opt.value ? 'bg-[#001219] text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <TypeMenu types={types} value={type} onChange={onType} />
    </div>
  );
}
