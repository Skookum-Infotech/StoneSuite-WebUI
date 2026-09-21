import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Building2, AlertTriangle, UserPlus } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { lookupService } from '@/services/lookupService';
import { cn } from '@/lib/utils';
import { customerCoreDefaults } from '@/lib/customerDefaults';
import { fieldCls } from '@/components/crm/formUtils';
import { hasExactName } from '@/lib/recordCreateReturn';
import { CUSTOMER_USABLE_STATUS } from '@/lib/crmStatusFlow';
import type { FilterClause } from '@/types/tenant';

const RESULT_LIMIT = 8;

// A customer's "status" is a CRM status (lkp_crm_status): Draft, Active, Inactive
// or Credit Hold. Only an Active customer can be used on other records, so it is
// the only one listed here — the backend refuses to create a document for any
// other (workflow/customer_usable.go). Matches the "status" filter contract used
// by CrmRecordTable: value is the numeric crm_status_id, resolved server-side
// against customer_crm_status.

export interface CustomerRef {
  id: string;
  name: string;
  /** Derived from the customer CRM record at pick time — undefined when the
   *  customer record has no value set for that field. Lets create forms
   *  auto-populate their own currency/tax/terms/price-level fields. */
  currencyId?: string;
  salesTaxPercent?: string;
  paymentTermsId?: string;
  priceLevelId?: string;
  /** The customer's effective Bill To address (its Billing Address block, or
   *  its primary Address when billing is flagged same-as-primary), plus
   *  contact info — lets create forms auto-populate their own Bill To
   *  section. See BILL_ADDRESS_KEYS (lib/customerDefaults.ts) for how these
   *  are merged into form state. */
  billAttn?: string;
  billAddress1?: string;
  billAddress2?: string;
  billSuite?: string;
  billCity?: string;
  billStateId?: string;
  billCountryId?: string;
  billZip?: string;
  billPhone?: string;
  billFax?: string;
  billEmail?: string;
}

// Billing-customer picker for the Sales Order create form. Opens showing the
// billable customer list immediately (no typing required); typing narrows it
// further by name. A customer is a searchable CRM record (not a static
// lookup list), so unlike the other Bill To fields this can't be a plain
// <select> — mirrors the debounced multi-entity pattern in GlobalSearch.tsx,
// narrowed to `customer`.
export function CustomerPicker({
  value,
  onChange,
  required,
  onCreateNew,
}: {
  value: CustomerRef | null;
  onChange: (customer: CustomerRef | null) => void;
  required?: boolean;
  /** Sends the user to create a new Customer CRM record for a typed name the
   *  list doesn't have (see useRecordCreateReturn). Omitted when the user
   *  can't create customers — the picker then only shows the warning. */
  onCreateNew?: (name: string) => void;
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

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const usableStatusIds = useMemo(
    () => (lookups?.crmStatuses ?? [])
      .filter((s) => s.code === CUSTOMER_USABLE_STATUS)
      .map((s) => String(s.id)),
    [lookups],
  );

  // Wait for the status lookup before querying, so we never briefly show an
  // unfiltered (all-statuses) list before narrowing to Active ones.
  const enabled = open && usableStatusIds.length > 0;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['customer-picker', debounced, usableStatusIds],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<CustomerRef[]> => {
      const filters: FilterClause[] = [{ field: 'status', op: 'in', value: usableStatusIds }];
      if (debounced) filters.push({ field: 'core:customer_name', op: 'contains', value: debounced });
      const page = await crmService.searchRecords('customer', {
        filters,
        sort: [{ field: 'updated_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records.map((r) => ({
        id: r.id,
        name: String(r.coreFields.customer_name ?? '(unnamed)'),
        ...customerCoreDefaults(r.coreFields),
      }));
    },
  });

  function select(customer: CustomerRef) {
    onChange(customer);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  function createNew() {
    setOpen(false);
    onCreateNew?.(debounced);
  }

  // Only once the search has actually settled — not while `enabled` is still
  // waiting on the status lookup — so this never flashes true on first open.
  const notFound = enabled && !isFetching && debounced.length > 0 && results.length === 0;
  const showCreateNew = Boolean(onCreateNew) && enabled && !isFetching && debounced.length > 0
    && !hasExactName(results, debounced);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Building2 className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change billing customer"
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
          required={required}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Click to browse, or search by name…"
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search billing customer"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching customers.' : 'No active customers available.'}
            </p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <Building2 className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {notFound && (
            <div role="status" className="px-3 py-2">
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">“{debounced}” isn't an existing customer.</span>
              </p>
              {!onCreateNew && (
                <p className="mt-0.5 pl-5 text-2xs text-stone-500">
                  Ask someone with customer access to add them first.
                </p>
              )}
            </div>
          )}
          {showCreateNew && (
            <button
              type="button"
              onClick={createNew}
              className="flex w-full items-center gap-2 border-t border-stone-100 px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-accent/10 transition-colors"
            >
              <UserPlus className="size-3.5 shrink-0 text-stone-500" aria-hidden="true" />
              <span className="truncate">Create “{debounced}” as a new customer</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
