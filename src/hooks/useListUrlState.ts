import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ListSortDir = 'asc' | 'desc';

const SEARCH_PARAM = 'q';
const SORT_PARAM = 'sort';
const DIR_PARAM = 'dir';

interface ListUrlStateOptions<F extends string> {
  /** Every column the list can sort by — anything else in the URL is ignored. */
  sortFields: readonly F[];
  /** The sort the list opens with. It is never written to the URL. */
  defaultSort: { field: F; dir: ListSortDir };
}

interface ListUrlState<F extends string> {
  /** The applied (already-debounced) search text. */
  search: string;
  sortBy: F;
  sortDir: ListSortDir;
  setSearch: (value: string) => void;
  setSort: (field: F, dir: ListSortDir) => void;
}

function isSortDir(value: string | null): value is ListSortDir {
  return value === 'asc' || value === 'desc';
}

/**
 * Keeps a list's search text and sort order in the URL (`?q=&sort=&dir=`) so a
 * reload, a shared link, or Back from a record's detail page lands on the same
 * view. Only the applied search is stored, never keystrokes, and a default
 * value is left off so an untouched list keeps a clean URL.
 *
 * Paging is deliberately not stored: keyset cursors are opaque and only valid
 * for the query that produced them, so a reloaded list starts on page one.
 * Writes use `replace` so tuning a list does not pile up history entries, and
 * any other query params (e.g. `?tab=`) are preserved.
 */
export function useListUrlState<F extends string>({
  sortFields,
  defaultSort,
}: ListUrlStateOptions<F>): ListUrlState<F> {
  const [params, setParams] = useSearchParams();

  const search = params.get(SEARCH_PARAM) ?? '';
  const rawSort = params.get(SORT_PARAM);
  const rawDir = params.get(DIR_PARAM);
  const sortBy = sortFields.find((f) => f === rawSort) ?? defaultSort.field;
  const sortDir = isSortDir(rawDir) ? rawDir : defaultSort.dir;

  // The setters read the latest values through a ref so their identity stays
  // stable: a table's debounce effect lists setSearch as a dependency and must
  // not re-fire (and reset paging) just because the URL changed.
  const latest = useRef({ search, sortBy, sortDir, setParams });
  useEffect(() => {
    latest.current = { search, sortBy, sortDir, setParams };
  });

  const setSearch = useCallback((value: string) => {
    const cur = latest.current;
    // Skip a no-op write: a replace navigation would drop the page's
    // location.state (e.g. a just-created record's highlight).
    if (value === cur.search) return;
    cur.setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(SEARCH_PARAM, value);
        else next.delete(SEARCH_PARAM);
        return next;
      },
      { replace: true },
    );
  }, []);

  const { field: defaultField, dir: defaultDir } = defaultSort;
  const setSort = useCallback(
    (field: F, dir: ListSortDir) => {
      const cur = latest.current;
      if (field === cur.sortBy && dir === cur.sortDir) return;
      cur.setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (field === defaultField && dir === defaultDir) {
            next.delete(SORT_PARAM);
            next.delete(DIR_PARAM);
          } else {
            next.set(SORT_PARAM, field);
            next.set(DIR_PARAM, dir);
          }
          return next;
        },
        { replace: true },
      );
    },
    [defaultField, defaultDir],
  );

  return { search, sortBy, sortDir, setSearch, setSort };
}
