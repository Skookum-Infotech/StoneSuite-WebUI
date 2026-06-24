import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  inputClassName?: string;
  hideKbd?: boolean;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

// Entities the global search fans out across. Each maps a CRM workflow to its
// detail route. The search reuses the per-entity scope-safe search endpoint, so
// the backend never returns records outside the caller's RBAC scope.
const SEARCHABLE = [
  { key: 'lead',        label: 'Lead',        detailPath: (id: string) => `/crm/lead/${id}` },
  { key: 'prospect',    label: 'Prospect',    detailPath: (id: string) => `/crm/prospect/${id}` },
  { key: 'customer',    label: 'Customer',    detailPath: (id: string) => `/crm/customer/${id}` },
  { key: 'sales_order', label: 'Sales Order', detailPath: (id: string) => `/sales/sales_order/${id}` },
] as const;

const MIN_CHARS = 2;
const PER_ENTITY_LIMIT = 5;

type Hit = {
  id: string;
  name: string;
  recordNumber?: string;
  entityLabel: string;
  path: string;
};

export function GlobalSearch({ className, inputClassName, autoFocus, onNavigate }: Props) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce so each keystroke doesn't fan out a request to every entity.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  // ⌘K / Ctrl+K focuses the search from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus for mobile expansion
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const enabled = debounced.length >= MIN_CHARS;

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ['global-search', debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Hit[]> => {
      const pages = await Promise.all(
        SEARCHABLE.map((e) =>
          crmService
            .searchRecords(e.key, {
              filters: [{ field: 'core:customer_name', op: 'contains', value: debounced }],
              sort: [{ field: 'updated_at', dir: 'desc' }],
              limit: PER_ENTITY_LIMIT,
            })
            // A workflow the tenant hasn't enabled (or no scope) shouldn't break
            // the whole search — degrade that entity to zero results.
            .catch(() => ({ records: [], nextCursor: '', hasMore: false, scope: '' }))
            .then((page) =>
              page.records.map<Hit>((r) => ({
                id: r.id,
                name: String(r.coreFields.customer_name ?? '(unnamed)'),
                recordNumber: r.recordNumber,
                entityLabel: e.label,
                path: e.detailPath(r.id),
              })),
            ),
        ),
      );
      return pages.flat();
    },
  });

  // Clamp the highlight to the current result set (it resets to 0 on each
  // keystroke via onChange) rather than mutating state inside an effect.
  const safeIndex = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : 0;

  const showDropdown = open && enabled;

  function go(hit: Hit) {
    setOpen(false);
    setTerm('');
    setDebounced('');
    onNavigate?.();
    navigate(hit.path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showDropdown || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[safeIndex];
      if (hit) go(hit);
    }
  }

  const placeholder = useMemo(() => 'Search leads, prospects, customers…', []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={term}
          placeholder={placeholder}
          aria-label="Global search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-full border border-white/[0.13] bg-white/[0.07] pl-4 pr-11 text-sm text-stone-200 placeholder:text-stone-400 transition-all focus:outline-none focus:border-brand/60 focus:bg-white/[0.10]',
            inputClassName,
          )}
          onChange={(e) => {
            setTerm(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Search icon button — right side */}
        <div className="pointer-events-none absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.10]">
          {isFetching ? (
            <Loader2 className="size-3.5 animate-spin text-stone-400" />
          ) : (
            <Search className="size-3.5 text-stone-400" />
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto overflow-x-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950"
        >
          {hits.length > 0 ? (
            <ul className="py-1">
              {hits.map((hit, i) => (
                <li key={`${hit.entityLabel}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === safeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(hit)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      i === safeIndex
                        ? 'bg-accent/15'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-900',
                    )}
                  >
                    <span className="inline-flex shrink-0 items-center rounded-md bg-brand/10 px-1.5 py-0.5 text-2xs font-semibold text-brand-dark dark:text-brand">
                      {hit.entityLabel}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                        {hit.name}
                      </span>
                      {hit.recordNumber && (
                        <span className="block truncate font-mono text-2xs text-stone-400">
                          {hit.recordNumber}
                        </span>
                      )}
                    </span>
                    {i === safeIndex && (
                      <CornerDownLeft className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : isFetching ? (
            <div className="px-4 py-6 text-center text-sm text-stone-500 dark:text-stone-400">
              Searching…
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="rounded-lg bg-brand/10 p-2.5">
                  <Sparkles className="size-5 text-brand" />
                </div>
              </div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                No matches for “{debounced}”
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Searches leads, prospects, customers, and sales orders you can access.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
