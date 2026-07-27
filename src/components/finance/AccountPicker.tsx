import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Landmark } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 8;

export interface AccountRef {
  id: string;
  code: string;
  name: string;
}

// Shared account picker — the highest-leverage piece of this module. Every
// screen that posts to a chart-of-accounts account (today: Default Accounts;
// future: invoice/payment/journal entry forms) uses this rather than its own
// query, so the one rule that matters is enforced in one place: always
// postable=true&active=true, the exact filter that keeps header ("super")
// accounts and inactive accounts out of every transaction dropdown. Mirrors
// VendorPicker's debounced search-as-you-type UX.
export function AccountPicker({
  value,
  onChange,
  required,
  placeholder = 'Click to browse, or search by code/name…',
  ariaLabel = 'Search account',
}: {
  value: AccountRef | null;
  onChange: (account: AccountRef | null) => void;
  required?: boolean;
  placeholder?: string;
  ariaLabel?: string;
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
    queryKey: ['account-picker', debounced],
    enabled: open,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<AccountRef[]> => {
      const page = await chartOfAccountsService.listAccounts({
        postable: true,
        active: true,
        search: debounced || undefined,
        limit: RESULT_LIMIT,
      });
      return page.records.map((a) => ({ id: a.id, code: a.code, name: a.name }));
    },
  });

  function select(account: AccountRef) {
    onChange(account);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Landmark className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="font-mono text-2xs text-stone-400 shrink-0">{value.code}</span>
        <span className="flex-1 truncate font-medium text-stone-800">{value.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change account"
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
          placeholder={placeholder}
          className={cn(fieldCls, 'pl-8')}
          aria-label={ariaLabel}
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching accounts.' : 'No postable accounts available.'}
            </p>
          )}
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => select(a)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="font-mono text-2xs text-stone-400 shrink-0">{a.code}</span>
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
