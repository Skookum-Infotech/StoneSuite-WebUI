import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { focusManager } from '@tanstack/react-query';
import { useActivityWatch } from './useActivityWatch';
import { IDLE_PAUSE_MS, resetActivityForTests } from '@/lib/userActivity';

describe('useActivityWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetActivityForTests(Date.now());
    focusManager.setFocused(undefined);
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it('pauses all polling after 5 minutes without input', () => {
    const { unmount } = renderHook(() => useActivityWatch());
    act(() => vi.advanceTimersByTime(IDLE_PAUSE_MS - 30_000));
    expect(focusManager.isFocused()).toBe(true);
    act(() => vi.advanceTimersByTime(45_000));
    expect(focusManager.isFocused()).toBe(false);
    unmount();
  });

  it('resumes at the first input', () => {
    const { unmount } = renderHook(() => useActivityWatch());
    act(() => vi.advanceTimersByTime(IDLE_PAUSE_MS + 30_000));
    expect(focusManager.isFocused()).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(focusManager.isFocused()).toBe(true);
    unmount();
  });

  it('keeps polling while the user keeps working', () => {
    const { unmount } = renderHook(() => useActivityWatch());
    for (let i = 0; i < 12; i++) {
      act(() => {
        vi.advanceTimersByTime(60_000);
        window.dispatchEvent(new Event('pointermove'));
      });
    }
    expect(focusManager.isFocused()).toBe(true);
    unmount();
  });

  it('gives focus back to the browser when unmounted', () => {
    const { unmount } = renderHook(() => useActivityWatch());
    act(() => vi.advanceTimersByTime(IDLE_PAUSE_MS + 30_000));
    unmount();
    expect(focusManager.isFocused()).toBe(true);
  });
});
