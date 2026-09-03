import { useEffect, useState } from 'react';

// Single source of truth for "should this session animate at all". Every
// dashboard motion primitive (useCountUp, the sparkline draw-in, the widget
// entrance stagger) gates on this so a user who has asked their OS for less
// motion gets the final state with no tween.
const QUERY = '(prefers-reduced-motion: reduce)';

function prefersReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReduced);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
