import { useState, useRef, useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, ShoppingCart } from 'lucide-react';
import { salesOrderService } from '@/services/salesOrderService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { SO_CONVERTIBLE_STATUSES } from '@/lib/salesOrderForm';

const RESULT_LIMIT = 25;

export interface FabricationSourceOrder {
  id: string;
  number: string;
  customerName: string;
}

// Sales-order picker for the standalone "New Fabrication Job" page — a job
// always originates from a sales order (backend spec §2.2), but unlike
// SalesOrderPicker (used inside a Credit Memo/Refund already scoped to one
// customer) there is no customer context yet here, so this searches sales
// orders globally by order # or customer name. Narrowed to the same
// confirmed-or-further statuses "Convert to Invoice" uses — a job spawned
// from an unconfirmed order isn't a real backend rule, just a sane default
// the backend itself doesn't enforce, so a 400 on create still wins if this
// ever mis-narrows.
//
// Combobox ARIA wiring mirrors RefundSourcePicker's pattern (role=combobox on
// the input, role=listbox/option on the popup) rather than inventing a new one.
export function FabricationSourceOrderPicker({ value, onChange, disabled }: {
  value: FabricationSourceOrder | null;
  onChange: (order: FabricationSourceOrder | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const enabled = open && !disabled;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['fabrication-source-order-picker', debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<FabricationSourceOrder[]> => {
      const page = await salesOrderService.searchOrders({
        search: debounced || undefined,
        sort: [{ field: 'created_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records
        .filter((r) => !r.statusCode || SO_CONVERTIBLE_STATUSES.has(r.statusCode))
        .map((r) => ({ id: r.id, number: r.salesOrderNumber, customerName: r.customer?.name ?? '' }));
    },
  });

  function select(order: FabricationSourceOrder) {
    onChange(order);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <ShoppingCart className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">
          {value.number}
          {value.customerName && <span className="ml-1.5 font-normal text-stone-400">· {value.customerName}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change sales order"
          className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open && enabled}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={disabled}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by order # or customer…"
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search sales order"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Sales order results"
          className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar"
        >
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching sales orders.' : 'Start typing to search sales orders.'}
            </p>
          )}
          {results.map((so) => (
            <button
              key={so.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => select(so)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <ShoppingCart className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate">{so.number}</span>
              {so.customerName && <span className="truncate text-stone-400">· {so.customerName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
