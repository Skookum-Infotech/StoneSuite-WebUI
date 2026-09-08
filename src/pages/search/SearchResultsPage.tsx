import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import { globalSearchService, MIN_SEARCH_CHARS, RESULTS_PAGE_LIMIT } from '@/services/globalSearchService';
import { entityLabel, compareEntityTypes, hitRoute } from '@/lib/searchEntity';
import { PageHeader, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { relativeTime } from '@/lib/recentRecordRoute';
import { cn } from '@/lib/utils';

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get('q') ?? '').trim();
  const typeParam = params.get('type') ?? '';

  // Local edit buffer for the input; re-sync to the URL's q whenever navigation
  // changes it (back/forward, a dropdown "see all" click) using React's
  // adjust-state-during-render pattern rather than an effect.
  const [term, setTerm] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setTerm(q);
  }

  const enabled = q.length >= MIN_SEARCH_CHARS;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['global-search-page', q],
    enabled,
    staleTime: 30 * 1000,
    queryFn: () => globalSearchService.search(q, { limit: RESULTS_PAGE_LIMIT }),
  });

  const groups = useMemo(() => {
    const entries = Object.entries(data?.groups ?? {}).filter(([, g]) => g.results.length > 0);
    entries.sort(([a], [b]) => compareEntityTypes(a, b));
    return entries;
  }, [data]);

  const totalCount = groups.reduce((n, [, g]) => n + g.results.length, 0);

  // Active tab: the ?type= if it has results, else the first group.
  const activeType = useMemo(() => {
    if (typeParam && groups.some(([t]) => t === typeParam)) return typeParam;
    return groups[0]?.[0] ?? '';
  }, [typeParam, groups]);

  const activeGroup = groups.find(([t]) => t === activeType)?.[1];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = term.trim();
    if (next.length >= MIN_SEARCH_CHARS) setParams({ q: next }, { replace: false });
  }

  function selectType(t: string) {
    const p: Record<string, string> = { q };
    if (t) p.type = t;
    setParams(p, { replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Search"
        subtitle={enabled ? `Results for “${q}”` : 'Search across everything you can access'}
      />

      <form onSubmit={submitSearch} className="mb-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search records, documents, people…"
            aria-label="Search"
            autoFocus
            className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-4 text-sm text-stone-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          />
        </div>
      </form>

      {!enabled && (
        <EmptyState>Type at least {MIN_SEARCH_CHARS} characters to search.</EmptyState>
      )}

      {enabled && isFetching && !data && <Spinner label="Searching…" />}
      {enabled && isError && <ErrorNote>Search is unavailable right now. Try again in a moment.</ErrorNote>}

      {enabled && data && !isError && (
        totalCount === 0 ? (
          <EmptyState>No matches for “{q}”.</EmptyState>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            {/* Type rail */}
            <nav aria-label="Result types" className="shrink-0 sm:w-52">
              <ul className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
                {groups.map(([t, g]) => (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() => selectType(t)}
                      aria-current={t === activeType ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                        t === activeType
                          ? 'bg-brand/10 font-semibold text-brand'
                          : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
                      )}
                    >
                      <span>{entityLabel(t)}</span>
                      <span className="text-2xs tabular-nums text-stone-400">
                        {g.results.length}
                        {g.hasMore ? '+' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Active group results */}
            <div className="min-w-0 flex-1">
              {activeGroup && (
                <>
                  <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-950">
                    {activeGroup.results.map((hit) => (
                      <li key={`${hit.type}-${hit.id}`}>
                        <button
                          type="button"
                          onClick={() => navigate(hitRoute(hit))}
                          className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-900"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                              {hit.displayName || '(untitled)'}
                            </span>
                            {(hit.number || hit.subtitle) && (
                              <span className="block truncate text-xs text-stone-400">
                                {[hit.number, hit.subtitle].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                          <time
                            dateTime={hit.updatedAt}
                            title={new Date(hit.updatedAt).toLocaleString()}
                            className="shrink-0 font-mono text-2xs text-stone-400"
                          >
                            {relativeTime(hit.updatedAt)}
                          </time>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {activeGroup.hasMore && (
                    <p className="mt-2 text-xs text-stone-400">
                      Showing the first {activeGroup.results.length} {entityLabel(activeType).toLowerCase()}. Add
                      another word to narrow the results.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
