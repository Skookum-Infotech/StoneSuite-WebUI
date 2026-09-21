import { useCallback, useSyncExternalStore } from 'react';

// Live result of a CSS media query, for layout decisions Tailwind's responsive
// classes can't express — e.g. which of two panes to mount at all, rather than
// mounting both and hiding one.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
