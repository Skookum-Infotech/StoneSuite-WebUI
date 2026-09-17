import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Scrolls a save/submit error banner into view and moves focus to it the
 * moment `error` appears — without this, a failure banner rendered above a
 * long form goes unnoticed when the user is scrolled down near the Save
 * button. Attach the returned ref to the banner's outer element and give
 * that element `tabIndex={-1}` so it can receive the programmatic focus.
 */
export function useScrollToError<T extends HTMLElement = HTMLDivElement>(error: unknown): RefObject<T | null> {
  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!error) return;
    ref.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    ref.current?.focus();
  }, [error, reducedMotion]);

  return ref;
}
