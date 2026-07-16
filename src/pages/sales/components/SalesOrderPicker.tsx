import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, ShoppingCart } from 'lucide-react';
import { salesOrderService } from '@/services/salesOrderService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 50;

export interface SalesOrderRef {
  id: string;
  number: string;
}

// Sales Order picker for Credit Memo's optional lineage field — scoped to one
// customer, mirroring InvoicePicker's debounced-search dropdown pattern
// exactly (including the same client-side narrowing trick: the SO resolver's
// customer filter isn't UUID-based, so this searches by the customer's name
// via the existing global `search` term and then filters results client-side
// to an exact `customer.id` match).
//
// Disabled until a customer is chosen.
export function SalesOrderPicker({
  customer, value, onChange, disabled,
}: {
  customer: { id: string; name: string } | null;
  value: SalesOrderRef | null;
  onChange: (order: SalesOrderRef | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const enabled = open && Boolean(customer) && !disabled;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['sales-order-picker', customer?.id, debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SalesOrderRef[]> => {
      const page = await salesOrderService.searchOrders({
        search: customer!.name,
        sort: [{ field: 'created_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      const scoped = page.records.filter((r) => r.customer?.id === customer!.id);
      const narrowed = debounced
        ? scoped.filter((r) => r.salesOrderNumber.toLowerCase().includes(debounced.toLowerCase()))
        : scoped;
      return narrowed.map((r) => ({ id: r.id, number: r.salesOrderNumber }));
    },
  });

  function select(order: SalesOrderRef) {
    onChange(order);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <ShoppingCart className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
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
          disabled={disabled || !customer}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={customer ? 'Click to browse, or search by order #…' : 'Select a customer first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search sales order"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching sales orders.' : 'No sales orders for this customer.'}
            </p>
          )}
          {results.map((so) => (
            <button
              key={so.id}
              type="button"
              onClick={() => select(so)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <ShoppingCart className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate">{so.number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
