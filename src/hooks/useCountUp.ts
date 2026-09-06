import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const DEFAULT_DURATION_MS = 700;
const FRAME_MS = 1000 / 60;

// easeOutCubic — decelerates into the final value the way a physical dial
// would settle, rather than the mechanical feel of a linear ramp.
function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Tweens a displayed number toward `target`: from 0 on first mount, and from
 * wherever it currently sits whenever `target` changes (a range switch, a
 * background refresh). Returns `target` verbatim — no animation, no frame
 * loop — when the user prefers reduced motion, so callers can render the
 * result unconditionally.
 */
export function useCountUp(target: number, options: { durationMs?: number } = {}): number {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const reduced = useReducedMotion();
  const animated = !reduced && durationMs > 0;

  const [display, setDisplay] = useState(() => (animated ? 0 : target));

  const displayRef = useRef(display);
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (!animated) return;
    const from = displayRef.current;
    if (from === target) return;

    const start = Date.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      if (progress >= 1) {
        setDisplay(target);
        clearInterval(id);
      } else {
        setDisplay(from + (target - from) * easeOut(progress));
      }
    }, FRAME_MS);

    return () => clearInterval(id);
  }, [target, durationMs, animated]);

  return animated ? display : target;
}
