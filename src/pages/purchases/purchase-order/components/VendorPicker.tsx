import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Building, AlertTriangle, UserPlus } from 'lucide-react';
import { vendorService } from '@/services/vendorService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { hasExactName } from '@/lib/recordCreateReturn';

const RESULT_LIMIT = 8;

export interface VendorRef {
  id: string;
  name: string;
}

// Vendor picker for the Purchase Order create form — mirrors CustomerPicker's
// debounced search-as-you-type UX. Unlike CustomerPicker, this doesn't
// restrict by status: the vendors resolver's "status" filter compares
// against the internal lkp_record_status FK id (no code-based lookup exposed
// yet), so — like VendorTable's own list — this searches by name only and
// leaves any active/inactive judgment to the person placing the order.
export function VendorPicker({
  value,
  onChange,
  required,
  onCreateNew,
}: {
  value: VendorRef | null;
  onChange: (vendor: VendorRef | null) => void;
  required?: boolean;
  /** Sends the user to create a new Vendor record for a typed name the list
   *  doesn't have (see useRecordCreateReturn). Omitted when the user can't
   *  create vendors, or when the caller wants to handle it differently (see
   *  ConvertToPurchaseOrderDialog) — the picker then only shows the warning. */
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

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['vendor-picker', debounced],
    enabled: open,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<VendorRef[]> => {
      const page = await vendorService.searchVendors({
        search: debounced || undefined,
        sort: [{ field: 'updated_at', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      return page.records.map((v) => ({ id: v.id, name: v.displayName }));
    },
  });

  function select(vendor: VendorRef) {
    onChange(vendor);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  function createNew() {
    setOpen(false);
    onCreateNew?.(debounced);
  }

  const notFound = open && !isFetching && debounced.length > 0 && results.length === 0;
  const showCreateNew = Boolean(onCreateNew) && open && !isFetching && debounced.length > 0
    && !hasExactName(results, debounced);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Building className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change vendor"
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
          aria-label="Search vendor"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching vendors.' : 'No vendors available.'}
            </p>
          )}
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => select(v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <Building className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate">{v.name}</span>
            </button>
          ))}
          {notFound && (
            <div role="status" className="px-3 py-2">
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">“{debounced}” isn't an existing vendor.</span>
              </p>
              {!onCreateNew && (
                <p className="mt-0.5 pl-5 text-2xs text-stone-500">
                  Ask someone with vendor access to add them first.
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
              <span className="truncate">Create “{debounced}” as a new vendor</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
