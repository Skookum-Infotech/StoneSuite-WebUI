import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Building2 } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { lookupService } from '@/services/lookupService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import type { FilterClause } from '@/types/tenant';

const RESULT_LIMIT = 8;

// A customer's "status" is a CRM pipeline stage (lkp_crm_status), not a plain
// active/inactive flag — only these two stages count as billable for a new
// Sales Order (matches the "status" filter contract used by CrmRecordTable:
// value is the numeric crm_status_id, resolved server-side against
// customer_crm_status).
const BILLABLE_STATUS_NAMES = ['Customer Closed Won', 'Customer Renewal'];

export interface CustomerRef {
  id: string;
  name: string;
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
}: {
  value: CustomerRef | null;
  onChange: (customer: CustomerRef | null) => void;
  required?: boolean;
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

  const billableStatusIds = useMemo(
    () => (lookups?.crmStatuses ?? [])
      .filter((s) => BILLABLE_STATUS_NAMES.includes(s.name))
      .map((s) => String(s.id)),
    [lookups],
  );

  // Wait for the status lookup before querying, so we never briefly show an
  // unfiltered (all-statuses) list before narrowing to billable ones.
  const enabled = open && billableStatusIds.length > 0;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['customer-picker', debounced, billableStatusIds],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<CustomerRef[]> => {
      const filters: FilterClause[] = [{ field: 'status', op: 'in', value: billableStatusIds }];
      if (debounced) filters.push({ field: 'core:customer_name', op: 'contains', value: debounced });
      const page = await crmService.searchRecords('customer', {
        filters,
        sort: [{ field: 'updated_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records.map((r) => ({
        id: r.id,
        name: String(r.coreFields.customer_name ?? '(unnamed)'),
      }));
    },
  });

  function select(customer: CustomerRef) {
    onChange(customer);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

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
              {debounced ? 'No matching customers.' : 'No billable customers available.'}
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
        </div>
      )}
    </div>
  );
}
