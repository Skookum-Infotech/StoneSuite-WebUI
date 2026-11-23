import { useCallback, useState } from 'react';

type SearchParamsInit = URLSearchParams | ((prev: URLSearchParams) => URLSearchParams);

/**
 * Stand-in for react-router's `useSearchParams` in tests that replace the whole
 * module with `vi.mock('react-router-dom', ...)` and so have no router context.
 * It keeps the params in component state, so list tables that persist their
 * search and sort in the URL (useListUrlState) still react to the user typing.
 */
export function useSearchParams(): [URLSearchParams, (next: SearchParamsInit) => void] {
  const [params, setParams] = useState(() => new URLSearchParams());
  const set = useCallback((next: SearchParamsInit) => {
    setParams((prev) => (typeof next === 'function' ? next(prev) : new URLSearchParams(next)));
  }, []);
  return [params, set];
}
