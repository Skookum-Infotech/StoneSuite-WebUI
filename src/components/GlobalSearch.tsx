import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Loader2, CornerDownLeft, ArrowRight } from 'lucide-react';
import { globalSearchService, MIN_SEARCH_CHARS } from '@/services/globalSearchService';
import { entityLabel, compareEntityTypes, hitRoute } from '@/lib/searchEntity';
import type { SearchHit } from '@/types/search';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  inputClassName?: string;
  hideKbd?: boolean;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

// Rows per group shown in the dropdown before the "See all" link (the backend
// caps each group at 6 regardless).
const PER_GROUP = 6;

// One keyboard-navigable row: either a record hit, a per-group "see all" link,
// or the final "see everything" link.
type NavItem =
  | { kind: 'hit'; hit: SearchHit; path: string }
  | { kind: 'group-all'; type: string; path: string }
  | { kind: 'all'; path: string };

export function GlobalSearch({ className, inputClassName, autoFocus, onNavigate }: Props) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce so each keystroke doesn't fan a request out to every module.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  // ⌘K / Ctrl+K focuses the search from anywhere.
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

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const enabled = debounced.length >= MIN_SEARCH_CHARS;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['global-search', debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: () => globalSearchService.search(debounced),
  });

  // Ordered, non-empty groups.
  const groups = useMemo(() => {
    const entries = Object.entries(data?.groups ?? {}).filter(([, g]) => g.results.length > 0);
    entries.sort(([a], [b]) => compareEntityTypes(a, b));
    return entries;
  }, [data]);

  // Flat list of every navigable row, in render order — the single source of
  // truth for arrow-key navigation across groups.
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    for (const [type, group] of groups) {
      for (const hit of group.results.slice(0, PER_GROUP)) {
        items.push({ kind: 'hit', hit, path: hitRoute(hit) });
      }
      if (group.hasMore) {
        items.push({ kind: 'group-all', type, path: `/search?q=${encodeURIComponent(debounced)}&type=${type}` });
      }
    }
    if (items.length > 0) {
      items.push({ kind: 'all', path: `/search?q=${encodeURIComponent(debounced)}` });
    }
    return items;
  }, [groups, debounced]);

  const safeIndex = navItems.length > 0 ? Math.min(activeIndex, navItems.length - 1) : 0;
  const showDropdown = open && enabled;
  const hasResults = groups.length > 0;

  function go(path: string) {
    setOpen(false);
    setTerm('');
    setDebounced('');
    onNavigate?.();
    navigate(path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'Enter' && !showDropdown && debounced.length >= MIN_SEARCH_CHARS) {
      e.preventDefault();
      go(`/search?q=${encodeURIComponent(debounced)}`);
      return;
    }
    if (!showDropdown || navItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % navItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + navItems.length) % navItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = navItems[safeIndex];
      if (item) go(item.path);
    }
  }

  // A running counter so each rendered row can find its own flat nav index.
  let rowCursor = -1;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={term}
          placeholder="Search everything…"
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
        <div className="pointer-events-none absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.10]">
          {isFetching ? (
            <Loader2 className="size-3.5 animate-spin text-stone-400" />
          ) : (
            <Search className="size-3.5 text-stone-400" />
          )}
        </div>
      </div>

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[28rem] overflow-y-auto overflow-x-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950"
        >
          {hasResults ? (
            <>
              {groups.map(([type, group]) => (
                <div key={type} className="py-1">
                  <div className="px-4 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-stone-400">
                    {entityLabel(type)}
                  </div>
                  <ul>
                    {group.results.slice(0, PER_GROUP).map((hit) => {
                      rowCursor += 1;
                      const idx = rowCursor;
                      return (
                        <li key={`${type}-${hit.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={idx === safeIndex}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => go(hitRoute(hit))}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                              idx === safeIndex ? 'bg-accent/15' : 'hover:bg-stone-50 dark:hover:bg-stone-900',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                                {hit.displayName || '(untitled)'}
                              </span>
                              {(hit.number || hit.subtitle) && (
                                <span className="block truncate text-2xs text-stone-400">
                                  {[hit.number, hit.subtitle].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                            {idx === safeIndex && (
                              <CornerDownLeft className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {group.hasMore &&
                      (() => {
                        rowCursor += 1;
                        const idx = rowCursor;
                        return (
                          <li>
                            <button
                              type="button"
                              role="option"
                              aria-selected={idx === safeIndex}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => go(`/search?q=${encodeURIComponent(debounced)}&type=${type}`)}
                              className={cn(
                                'flex w-full items-center gap-1.5 px-4 py-1.5 text-left text-2xs font-medium text-brand transition-colors',
                                idx === safeIndex ? 'bg-accent/15' : 'hover:bg-stone-50 dark:hover:bg-stone-900',
                              )}
                            >
                              See all {entityLabel(type)}
                              <ArrowRight className="size-3" aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })()}
                  </ul>
                </div>
              ))}
              {(() => {
                rowCursor += 1;
                const idx = rowCursor;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === safeIndex}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(`/search?q=${encodeURIComponent(debounced)}`)}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 border-t border-stone-100 px-4 py-2.5 text-xs font-semibold text-stone-600 transition-colors dark:border-stone-800 dark:text-stone-300',
                      idx === safeIndex ? 'bg-accent/15' : 'hover:bg-stone-50 dark:hover:bg-stone-900',
                    )}
                  >
                    See all results for “{debounced}”
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                );
              })()}
            </>
          ) : isFetching ? (
            <div className="px-4 py-6 text-center text-sm text-stone-500 dark:text-stone-400">Searching…</div>
          ) : isError ? (
            <div className="px-4 py-6 text-center text-sm text-red-500">Search is unavailable right now.</div>
          ) : (
            <div className="px-4 py-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="rounded-lg bg-brand/10 p-2.5">
                  <Sparkles className="size-5 text-brand" />
                </div>
              </div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">No matches for “{debounced}”</p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Searches everything you can access — records, documents, people.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
