import { useLayoutEffect, useRef } from 'react';

/** Where the element starts, for a height of `calc(100dvh - var(--fill-top))`. */
export const FILL_TOP_VAR = '--fill-top';

/** For an element that should end exactly at the bottom of the window, not
 *  push the page taller. A percentage height can't do that inside the app
 *  layout, whose own height is "at least the screen" rather than "the
 *  screen", so this measures how far down the page the element starts (the
 *  header and the breadcrumb bar above it, whatever height they are) and
 *  keeps that up to date as the window or the page above it changes. */
export function useFillViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      el.style.setProperty(FILL_TOP_VAR, `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    // The breadcrumb bar can wrap onto a second line, moving the element down.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  return ref;
}
