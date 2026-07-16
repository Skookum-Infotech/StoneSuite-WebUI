import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Receipt } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 50;

export interface InvoiceRef {
  id: string;
  number: string;
  balanceDue: number;
}

// Invoice picker for applying a payment's balance — scoped to one customer
// (a payment can only be applied to invoices belonging to its own customer;
// the backend rejects a mismatch with 400). Mirrors CustomerPicker's
// debounced-search dropdown pattern.
//
// The invoice resolver's `customer_id` filter field resolves to the
// customer's internal serial id (i.invoice_customer_id::text), not its UUID
// (StoneSuite-Backend invoice/resolver.go) — there is no filter field that
// accepts the customer UUID CustomerPicker deals in. So instead of filtering
// server-side by id, this narrows server-side by the customer's *name* (via
// the existing global `search` term, which already matches customer_name per
// the invoice SearchPredicate) and then filters the results client-side to
// an exact `customer.id` match, which every InvoiceSummary row already
// carries.
//
// Disabled until a customer is chosen. Fully-paid invoices (balanceDue <= 0)
// and ids in `excludeIds` (already added to this payment's applications)
// are filtered out of the results.
export function InvoicePicker({
  customer, value, onChange, excludeIds = [], disabled,
}: {
  customer: { id: string; name: string } | null;
  value: InvoiceRef | null;
  onChange: (invoice: InvoiceRef | null) => void;
  excludeIds?: string[];
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
    queryKey: ['invoice-picker', customer?.id, debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<InvoiceRef[]> => {
      const page = await invoiceService.searchInvoices({
        search: customer!.name,
        sort: [{ field: 'invoice_date', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      const scoped = page.records.filter((r) => r.customer.id === customer!.id);
      const narrowed = debounced
        ? scoped.filter((r) => r.invoiceNumber.toLowerCase().includes(debounced.toLowerCase()))
        : scoped;
      return narrowed.map((r) => ({ id: r.id, number: r.invoiceNumber, balanceDue: r.balanceDue }));
    },
  });

  const filtered = results.filter((r) => r.balanceDue > 0 && !excludeIds.includes(r.id));

  function select(invoice: InvoiceRef) {
    onChange(invoice);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Receipt className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {value.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} due
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change invoice"
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
          placeholder={customer ? 'Click to browse, or search by invoice #…' : 'Select a customer first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search invoice"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {filtered.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching invoices with a balance due.' : 'No open invoices for this customer.'}
            </p>
          )}
          {filtered.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => select(inv)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Receipt className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="truncate">{inv.number}</span>
              </span>
              <span className="shrink-0 tabular-nums text-stone-400">
                {inv.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
