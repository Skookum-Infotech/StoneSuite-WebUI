import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, FileCheck } from 'lucide-react';
import { vendorBillService } from '@/services/vendorBillService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { VP_PAYABLE_BILL_STATUSES } from '@/lib/vendorPaymentForm';

const RESULT_LIMIT = 50;

export interface VendorBillRef {
  id: string;
  number: string;
  balanceDue: number;
}

// Vendor bill picker for applying a payment's balance — scoped to one vendor
// (the backend rejects a cross-vendor application with 400). The AP mirror of
// InvoicePicker, and it inherits the same constraint: the vendor_bill
// resolver's `vendor_id` filter compares against the vendor's internal serial
// id (vendorbill/resolver.go), not the UUID a VendorPicker deals in, so this
// narrows server-side by the vendor's *name* through the global `search` term
// (already matched by the bill SearchPredicate) and then filters client-side
// to an exact `vendor.id` match, which every VendorBillSummary row carries.
//
// Disabled until a vendor is chosen. Bills outside the payable statuses
// (vendorbill.PayableStatuses — a bill must be approved first), fully-settled
// bills (balanceDue <= 0), and ids in `excludeIds` (already applied on this
// payment) are filtered out.
export function VendorBillPicker({
  vendor, value, onChange, excludeIds = [], disabled,
}: {
  vendor: { id: string; name: string } | null;
  value: VendorBillRef | null;
  onChange: (bill: VendorBillRef | null) => void;
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

  const enabled = open && Boolean(vendor) && !disabled;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['vendor-bill-picker', vendor?.id, debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<VendorBillRef[]> => {
      const page = await vendorBillService.searchVendorBills({
        search: vendor!.name,
        sort: [{ field: 'bill_date', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      const scoped = page.records.filter(
        (r) => r.vendor?.id === vendor!.id && VP_PAYABLE_BILL_STATUSES.has(r.statusCode),
      );
      const narrowed = debounced
        ? scoped.filter((r) => r.vendorBillNumber.toLowerCase().includes(debounced.toLowerCase()))
        : scoped;
      return narrowed.map((r) => ({ id: r.id, number: r.vendorBillNumber, balanceDue: r.balanceDue }));
    },
  });

  const filtered = results.filter((r) => r.balanceDue > 0 && !excludeIds.includes(r.id));

  function select(bill: VendorBillRef) {
    onChange(bill);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <FileCheck className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {value.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} due
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change vendor bill"
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
          disabled={disabled || !vendor}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={vendor ? 'Click to browse, or search by bill #…' : 'Select a vendor first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search vendor bill"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {filtered.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced
                ? 'No matching approved bills with a balance due.'
                : 'No approved bills with a balance due for this vendor.'}
            </p>
          )}
          {filtered.map((bill) => (
            <button
              key={bill.id}
              type="button"
              onClick={() => select(bill)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <FileCheck className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="truncate">{bill.number}</span>
              </span>
              <span className="shrink-0 tabular-nums text-stone-400">
                {bill.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
