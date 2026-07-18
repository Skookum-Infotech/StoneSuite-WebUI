import { useState, useRef, useEffect, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, CreditCard, ReceiptText } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { creditMemoService } from '@/services/creditMemoService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { SOURCE_KIND_LABELS, type RefundSourceKind } from '@/lib/refundForm';

const RESULT_LIMIT = 50;

/** Statuses at which a source can back a refund application (backend spec §8):
 *  a VOID payment authorizes nothing, and a credit memo must be APPV or APPL —
 *  a DRFT or VOID credit memo authorizes nothing either. Filtering here spares
 *  the user a guaranteed 400; the server re-checks regardless. */
const ELIGIBLE_PAYMENT_STATUSES = new Set(['PEND', 'APPV', 'DEPO']);
const ELIGIBLE_CREDIT_MEMO_STATUSES = new Set(['APPV', 'APPL']);

export interface RefundSourceRef {
  kind: RefundSourceKind;
  id: string;
  number: string;
  /** The source's *unapplied* balance — an indicative ceiling, not the true
   *  available amount. See the note on availability below. */
  unappliedAmount: number;
}

// Source picker for the refund application ledger — the one piece of this
// module with no existing sibling, because no other record type draws from
// two different document types through one ledger (spec AD-2's XOR).
//
// Scoped to one customer: a refund can only draw from its own customer's
// payments/credit memos (the backend rejects a mismatch with 400). Like
// InvoicePicker, neither the payment nor the credit-memo resolver exposes a
// filter field accepting a customer UUID (both `customer_id` fields resolve to
// the internal serial id), so this narrows server-side by the customer's name
// via the global `search` term and then filters to an exact `customer.id`
// match client-side.
//
// On availability: the backend caps an application at
// min(refund.unapplied, source.unapplied - source.refunded_total) (AD-6), but
// `refunded_total` is NOT exposed on either source's JSON — payment/types.go
// and creditmemo/types.go emit appliedTotal/unappliedAmount and no refunded
// total. So the frontend cannot compute true availability, and this picker
// deliberately labels what it shows "unapplied" rather than "available": for a
// source that has already been partly refunded, the real ceiling is lower.
// Overshoot is rejected 400 with a server message, never silently clamped, so
// the dialog surfaces that message rather than pre-validating against a number
// it knows may be too generous.
export function RefundSourcePicker({ customer, kind, value, onChange, excludeIds = [] }: {
  customer: { id: string; name: string } | null;
  kind: RefundSourceKind;
  value: RefundSourceRef | null;
  onChange: (source: RefundSourceRef | null) => void;
  excludeIds?: string[];
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Both source kinds render a picker on the same page (AddRefundPage's
  // lineage section), so the listbox id must be per-instance.
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
      // Escape closes the results without picking — the only keyboard exit
      // from an open popup that the mousedown listener can't provide.
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const enabled = open && Boolean(customer);
  const Icon = kind === 'payment' ? CreditCard : ReceiptText;
  const label = SOURCE_KIND_LABELS[kind];

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['refund-source-picker', kind, customer?.id, debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<RefundSourceRef[]> => {
      if (kind === 'payment') {
        const page = await paymentService.searchPayments({
          search: customer!.name,
          sort: [{ field: 'payment_date', dir: 'desc' }],
          limit: RESULT_LIMIT,
        });
        return page.records
          .filter((r) => r.customer.id === customer!.id && ELIGIBLE_PAYMENT_STATUSES.has(r.statusCode))
          .map((r) => ({ kind, id: r.id, number: r.paymentNumber, unappliedAmount: r.unappliedAmount }));
      }
      const page = await creditMemoService.searchCreditMemos({
        search: customer!.name,
        sort: [{ field: 'credit_memo_date', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records
        .filter((r) => r.customer.id === customer!.id && ELIGIBLE_CREDIT_MEMO_STATUSES.has(r.statusCode))
        .map((r) => ({ kind, id: r.id, number: r.creditMemoNumber, unappliedAmount: r.unappliedAmount }));
    },
  });

  const filtered = results.filter(
    (r) =>
      r.unappliedAmount > 0 &&
      !excludeIds.includes(r.id) &&
      (!debounced || r.number.toLowerCase().includes(debounced.toLowerCase())),
  );

  function select(source: RefundSourceRef) {
    onChange(source);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Icon className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {value.unappliedAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} unapplied
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Change ${label.toLowerCase()}`}
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
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open && enabled}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={!customer}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={customer ? `Click to browse, or search by ${label.toLowerCase()} #…` : 'Select a customer first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label={`Search ${label.toLowerCase()}`}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" aria-hidden="true" />
        )}
      </div>

      {open && enabled && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} results`}
          className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar"
        >
          {filtered.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced
                ? `No matching ${label.toLowerCase()}s with an unapplied balance.`
                : `No ${label.toLowerCase()}s with an unapplied balance for this customer.`}
            </p>
          )}
          {filtered.map((source) => (
            <button
              key={source.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => select(source)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Icon className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="truncate">{source.number}</span>
              </span>
              <span className="shrink-0 tabular-nums text-stone-400">
                {source.unappliedAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
