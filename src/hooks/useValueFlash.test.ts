import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValueFlash } from './useValueFlash';

afterEach(() => {
  vi.useRealTimers();
});

describe('useValueFlash', () => {
  it('does not flash on the initial render', () => {
    const { result } = renderHook(() => useValueFlash(10));
    expect(result.current).toBe(false);
  });

  it('flashes when the value changes, then settles after the window', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }: { value: number }) => useValueFlash(value, 1000), {
      initialProps: { value: 10 },
    });

    rerender({ value: 25 });
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it('does not flash when the value is re-rendered unchanged', () => {
    const { result, rerender } = renderHook(({ value }: { value: number }) => useValueFlash(value), {
      initialProps: { value: 10 },
    });

    rerender({ value: 10 });
    expect(result.current).toBe(false);
  });

  it('cleans up its timer on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ value }: { value: number }) => useValueFlash(value, 1000), {
      initialProps: { value: 10 },
    });

    rerender({ value: 25 });
    unmount();

    expect(() => act(() => vi.advanceTimersByTime(2000))).not.toThrow();
  });

  // Comparison is by ===, so a string id works identically to a number — the
  // "a row I just created" use case (AccountTreeView), not just "a figure
  // that moved".
  it('flashes for a string value too, e.g. a just-created row id', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }: { value: string | null }) => useValueFlash(value, 1000),
      { initialProps: { value: null as string | null } },
    );

    expect(result.current).toBe(false);
    rerender({ value: 'account-123' });
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });
});
