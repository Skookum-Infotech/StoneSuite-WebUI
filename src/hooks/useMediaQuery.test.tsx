import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

const QUERY = '(min-width: 1280px)';

// A controllable stand-in for window.matchMedia: `matches` starts as given and
// flips on demand, notifying whoever subscribed — the way a resize does.
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  })) as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      matches = next;
      act(() => listeners.forEach((listener) => listener()));
    },
    listenerCount: () => listeners.size,
  };
}

let originalMatchMedia: typeof window.matchMedia;
beforeEach(() => {
  originalMatchMedia = window.matchMedia;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useMediaQuery', () => {
  it.each([true, false])('reports the current match (%s)', (initial) => {
    stubMatchMedia(initial);

    const { result } = renderHook(() => useMediaQuery(QUERY));

    expect(result.current).toBe(initial);
  });

  // The inbox swaps between one pane and two as the window is resized.
  it('follows the viewport as it starts and stops matching', () => {
    const viewport = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(QUERY));

    viewport.set(true);
    expect(result.current).toBe(true);

    viewport.set(false);
    expect(result.current).toBe(false);
  });

  it('stops listening once the component unmounts', () => {
    const viewport = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery(QUERY));
    expect(viewport.listenerCount()).toBe(1);

    unmount();

    expect(viewport.listenerCount()).toBe(0);
  });
});
