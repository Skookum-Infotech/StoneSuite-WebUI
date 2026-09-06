import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: reduced,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useCountUp', () => {
  it('returns the target immediately when the user prefers reduced motion', () => {
    stubReducedMotion(true);
    const { result } = renderHook(() => useCountUp(500));
    expect(result.current).toBe(500);
  });

  it('rolls from zero up to exactly the target over the given duration', () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(100, { durationMs: 600 }));

    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe(100);
  });

  it('animates toward a new target when the target prop changes', () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useCountUp(target, { durationMs: 500 }),
      { initialProps: { target: 100 } },
    );

    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toBe(100);

    rerender({ target: 300 });
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(300);

    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe(300);
  });

  it('stops animating cleanly after unmount', () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCountUp(100, { durationMs: 500 }));

    unmount();

    expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
    expect(result.current).toBe(0);
  });
});
