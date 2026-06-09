import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Users } from 'lucide-react';
import { leadService } from '@/services/leadService';
import { prospectService } from '@/services/prospectService';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/lead';

type ResultItem = {
  id: string;
  kind: 'lead' | 'prospect';
  label: string;
  subtitle: string;
  status: string;
  path: string;
};

const MAX_PER_GROUP = 5;

function leadLabel(l: Lead): string {
  if (l.type === 'Individual') {
    return [l.firstName, l.lastName].filter(Boolean).join(' ') || l.companyName || 'Unnamed';
  }
  return l.companyName || 'Unnamed';
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

export function GlobalSearch({ className, inputClassName, hideKbd, autoFocus, onNavigate }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch once and cache for 5 min — reused across all search keystrokes
  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: leadService.list,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });
  const prospectsQ = useQuery({
    queryKey: ['prospects'],
    queryFn: prospectService.list,
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
      .filter(l => match(l.companyName, l.firstName, l.lastName, l.email, l.leadId))
      .slice(0, MAX_PER_GROUP)
      .map(l => ({
        id: l.id,
        kind: 'lead',
        label: leadLabel(l),
        subtitle: l.email || l.leadId || '',
        status: l.leadStatus,
        path: '/crm/lead',
      }));

    const prospectResults: ResultItem[] = (prospectsQ.data ?? [])
      .filter(p => match(p.company_name, p.email, p.customer_id, p.billing_account_name))
      .slice(0, MAX_PER_GROUP)
      .map(p => ({
        id: p.id,
        kind: 'prospect',
        label: p.company_name || 'Unnamed',
        subtitle: p.email || p.customer_id || '',
        status: p.status,
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
        <Search className="pointer-events-none absolute left-3 size-3.5 text-stone-400" />
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
            'h-9 w-full rounded-xl border border-stone-200 bg-stone-50/80 pl-8 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200 dark:placeholder:text-stone-500 dark:focus:border-brand transition-all',
            hideKbd ? 'pr-3' : 'pr-12',
            inputClassName,
          )}
        />
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
            <div className="max-h-[22rem] overflow-y-auto">
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
