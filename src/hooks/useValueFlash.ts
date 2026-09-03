import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 1200;

/**
 * Returns `true` for a short window after `value` changes (and never on the
 * first render), so a widget can briefly highlight a figure that just moved
 * during a background refresh — the visual cue for "this number is new".
 */
export function useValueFlash(value: number, durationMs: number = DEFAULT_DURATION_MS): boolean {
  const [flashing, setFlashing] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const id = setTimeout(() => setFlashing(false), durationMs);
    return () => clearTimeout(id);
  }, [value, durationMs]);

  return flashing;
}
