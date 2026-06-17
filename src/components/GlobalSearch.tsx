import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Users } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

type ResultItem = {
  id: string;
  kind: 'lead' | 'prospect';
  label: string;
  subtitle: string;
  status: string;
  path: string;
};

const MAX_PER_GROUP = 5;

function recordLabel(coreFields: Record<string, unknown>): string {
  const company = coreFields.company_name;
  if (typeof company === 'string' && company) return company;
  const name = [coreFields.first_name, coreFields.last_name].filter(Boolean).join(' ');
  return name || 'Unnamed';
}

interface Props {
  className?: string;
  inputClassName?: string;
  /** Hide ⌘K badge — used in mobile row where there's no room for it */
  hideKbd?: boolean;
  /** Auto-focus input on mount — for mobile expansion */
  autoFocus?: boolean;
  /** Called after navigating to a result (e.g. so mobile can close) */
  onNavigate?: () => void;
}

export function GlobalSearch({ className, inputClassName, autoFocus, onNavigate }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch once and cache for 5 min — reused across all search keystrokes
  const leadsQ = useQuery({
    queryKey: ['crm-records', 'lead'],
    queryFn: () => crmService.listRecords('lead'),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });
  const prospectsQ = useQuery({
    queryKey: ['crm-records', 'prospect'],
    queryFn: () => crmService.listRecords('prospect'),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });

  // ⌘K / Ctrl+K focuses the search from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus for mobile expansion
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const results = useMemo((): ResultItem[] => {
    const q = query.trim();
    if (q.length < 2) return [];
    const lq = q.toLowerCase();
    const match = (...fields: (string | undefined)[]) =>
      fields.some(f => f?.toLowerCase().includes(lq));

    const leadResults: ResultItem[] = (leadsQ.data ?? [])
      .filter(l => match(
        String(l.coreFields.company_name ?? ''),
        String(l.coreFields.first_name ?? ''),
        String(l.coreFields.last_name ?? ''),
        String(l.coreFields.email ?? ''),
        l.recordNumber,
      ))
      .slice(0, MAX_PER_GROUP)
      .map(l => ({
        id: l.id,
        kind: 'lead',
        label: recordLabel(l.coreFields),
        subtitle: String(l.coreFields.email ?? l.recordNumber ?? ''),
        status: '',
        path: `/crm/lead/${l.id}`,
      }));

    const prospectResults: ResultItem[] = (prospectsQ.data ?? [])
      .filter(p => match(
        String(p.coreFields.company_name ?? ''),
        String(p.coreFields.email ?? ''),
        p.recordNumber,
      ))
      .slice(0, MAX_PER_GROUP)
      .map(p => ({
        id: p.id,
        kind: 'prospect',
        label: recordLabel(p.coreFields),
        subtitle: String(p.coreFields.email ?? p.recordNumber ?? ''),
        status: '',
        path: `/prospects/${p.id}`,
      }));

    return [...leadResults, ...prospectResults];
  }, [query, leadsQ.data, prospectsQ.data]);

  const goTo = useCallback((item: ResultItem) => {
    navigate(item.path);
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    onNavigate?.();
  }, [navigate, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      goTo(results[activeIndex]);
    }
  };

  const showDropdown = open && query.trim().length >= 2;
  const isLoading = leadsQ.isLoading || prospectsQ.isLoading;
  const leadResults = results.filter(r => r.kind === 'lead');
  const prospectResults = results.filter(r => r.kind === 'prospect');

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search your workspace"
          aria-label="Global search"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-full border border-white/[0.13] bg-white/[0.07] pl-4 pr-11 text-sm text-stone-200 placeholder:text-white focus:border-white/25 focus:bg-white/[0.11] focus:outline-none transition-all',
            inputClassName,
          )}
        />
        {/* Search icon button — right side */}
        <div className="pointer-events-none absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.10]">
          <Search className="size-3.5 text-stone-400" />
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-xs text-stone-400">
              Searching…
            </div>
          )}

          {!isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-stone-400">
              No results for <span className="font-semibold text-stone-600">"{query}"</span>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="max-h-[22rem] overflow-y-auto modal-scrollbar">
              {leadResults.length > 0 && (
                <section>
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-2xs font-bold uppercase tracking-widest text-stone-400">
                    <Sparkles className="size-3 text-purple-400" />
                    Leads
                  </p>
                  {leadResults.map(item => (
                    <ResultRow
                      key={item.id}
                      item={item}
                      active={results.indexOf(item) === activeIndex}
                      onMouseEnter={() => setActiveIndex(results.indexOf(item))}
                      onClick={() => goTo(item)}
                    />
                  ))}
                </section>
              )}

              {prospectResults.length > 0 && (
                <section className={leadResults.length > 0 ? 'border-t border-stone-100 dark:border-stone-900' : ''}>
                  <p className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-2xs font-bold uppercase tracking-widest text-stone-400">
                    <Users className="size-3 text-blue-400" />
                    Prospects
                  </p>
                  {prospectResults.map(item => (
                    <ResultRow
                      key={item.id}
                      item={item}
                      active={results.indexOf(item) === activeIndex}
                      onMouseEnter={() => setActiveIndex(results.indexOf(item))}
                      onClick={() => goTo(item)}
                    />
                  ))}
                </section>
              )}

              <div className="border-t border-stone-100 px-3 py-2 dark:border-stone-900">
                <p className="text-2xs text-stone-400">
                  {results.length} result{results.length !== 1 ? 's' : ''}&ensp;·&ensp;↑↓ navigate&ensp;·&ensp;↵ open&ensp;·&ensp;esc clear
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  item,
  active,
  onMouseEnter,
  onClick,
}: {
  item: ResultItem;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = item.kind === 'lead' ? Sparkles : Users;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
        active ? 'bg-stone-50 dark:bg-stone-900/60' : 'hover:bg-stone-50 dark:hover:bg-stone-900/40',
      )}
    >
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        item.kind === 'lead'
          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      )}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-stone-800 dark:text-stone-200">
          {item.label}
        </p>
        {item.subtitle && (
          <p className="truncate text-2xs text-stone-400">{item.subtitle}</p>
        )}
      </div>
      {item.status && (
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-2xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          {item.status}
        </span>
      )}
    </button>
  );
}
