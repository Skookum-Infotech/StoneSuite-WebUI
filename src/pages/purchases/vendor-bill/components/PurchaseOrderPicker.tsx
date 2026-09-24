import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Package } from 'lucide-react';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import type { VendorBillPurchaseOrderRef } from '@/types/vendorBill';

const RESULT_LIMIT = 50;
/** The purchase order filter key holding the vendor's public id (`vendor.id`). */
const VENDOR_FILTER_FIELD = 'vendor_uuid';
const SEARCH_DEBOUNCE_MS = 300;
const RESULTS_STALE_MS = 30 * 1000;

interface PurchaseOrderRow extends VendorBillPurchaseOrderRef {
  status: string;
}

// Purchase order picker for a vendor bill's optional lineage field — scoped to
// one vendor (the backend rejects linking another vendor's order with 400).
//
// The vendor is pinned with an exact `vendor_uuid` filter, the same public id a
// VendorPicker hands us, so the server returns precisely that vendor's orders.
// Do NOT narrow by the vendor's *name* instead: a picked vendor's display name
// carries a person's honorific ("Mrs Stella Sosa") while an order stores the
// name as it stood when it was placed ("Stella Sosa"), so a name search finds
// nothing for person vendors and goes stale on any rename. The typed term is
// the global `search`, ANDed with that filter.
//
// Every status is offered on purpose: a vendor can invoice before goods arrive,
// and the link is only a reference (the bill copies no lines and records no
// billed quantity — that is the PO's "Convert to Bill"). Disabled until a
// vendor is chosen.
export function PurchaseOrderPicker({
  vendor, value, onChange, disabled,
}: {
  vendor: { id: string; name: string } | null;
  value: VendorBillPurchaseOrderRef | null;
  onChange: (order: VendorBillPurchaseOrderRef | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
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

  const { data: results = [], isFetching, error } = useQuery({
    queryKey: ['vendor-bill-po-picker', vendor?.id, debounced],
    enabled,
    staleTime: RESULTS_STALE_MS,
    queryFn: async (): Promise<PurchaseOrderRow[]> => {
      if (!vendor) return [];
      const page = await purchaseOrderService.searchPurchaseOrders({
        filters: [{ field: VENDOR_FILTER_FIELD, op: 'eq', value: vendor.id }],
        search: debounced || undefined,
        sort: [{ field: 'updated_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records.map((r) => ({ id: r.id, number: r.purchaseOrderNumber, status: r.status }));
    },
  });

  function select(order: PurchaseOrderRow) {
    onChange({ id: order.id, number: order.number });
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Package className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove purchase order link"
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
          placeholder={vendor ? 'Click to browse, or search by PO #…' : 'Select a vendor first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search purchase order"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {error && !isFetching && (
            // A failed search must not read as "this vendor has no orders".
            <p role="alert" className="px-3 py-2 text-xs text-red-600">
              {apiErrorMessage(error, 'Failed to load purchase orders.')}
            </p>
          )}
          {!error && results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching purchase orders.' : 'No purchase orders for this vendor.'}
            </p>
          )}
          {results.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => select(order)}
              aria-label={`Link purchase order ${order.number}`}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Package className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="truncate">{order.number}</span>
              </span>
              <span className="shrink-0 text-stone-400">{order.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
