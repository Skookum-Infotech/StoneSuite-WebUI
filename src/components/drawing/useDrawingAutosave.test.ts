// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DrawingArea } from '@/types/drawing';

vi.mock('@/services/drawingService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  drawingService: { saveDrawing: vi.fn() },
}));

import { DrawingConflictError, drawingService } from '@/services/drawingService';
import { useDrawingAutosave } from './useDrawingAutosave';

const AREAS: DrawingArea[] = [];
// Stable across re-renders, same as the real caller's state.present from a
// useReducer — only a new object when the document actually changes. An
// object literal recreated inside the render callback would instead look
// "changed" to the debounce effect on every internal setStatus-triggered
// re-render, re-triggering it endlessly.
const DEFAULT_PRESENT = { areas: AREAS, displayUnit: 'in' as const, fractionDenominator: 32 as const };

// What the editor "was opened with" — a different object from DEFAULT_PRESENT,
// so the first render below is the unedited document and the rerender to
// DEFAULT_PRESENT is the user's first edit.
const OPENED_PRESENT = { areas: AREAS, displayUnit: 'in' as const, fractionDenominator: 32 as const };

/** Renders the hook and, unless `untouched`, makes one edit — saving only
 *  ever starts from an edit, never from merely opening the drawing. */
function renderAutosave(overrides: Partial<Parameters<typeof useDrawingAutosave>[0]> = {}, untouched = false) {
  const base = {
    salesOrderId: 'so1',
    present: DEFAULT_PRESENT,
    recordVersion: 1,
    onSaved: vi.fn(),
    onConflict: vi.fn(),
    paused: false,
    ...overrides,
  };
  const hook = renderHook(
    (props: Partial<Parameters<typeof useDrawingAutosave>[0]>) => useDrawingAutosave({ ...base, ...props }),
    { initialProps: { present: OPENED_PRESENT } as Partial<Parameters<typeof useDrawingAutosave>[0]> },
  );
  if (!untouched) act(() => hook.rerender({}));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDrawingAutosave — debounce', () => {
  it('does not save before 3s have passed since the last change', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    renderAutosave();
    act(() => vi.advanceTimersByTime(2999));
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
  });

  it('never saves just because the drawing was opened', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    renderAutosave({}, true);
    act(() => vi.advanceTimersByTime(10_000));
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
  });

  it('saves 3s after the last change', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    renderAutosave();
    act(() => vi.advanceTimersByTime(3000));
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1);
  });

  it('restarts the debounce when present changes again before it fires', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    const { rerender } = renderAutosave();
    act(() => vi.advanceTimersByTime(2000));
    rerender({ present: { areas: AREAS, displayUnit: 'mm', fractionDenominator: 32 } });
    act(() => vi.advanceTimersByTime(2000)); // 4000ms since first change, but only 2000ms since the second
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000)); // 3000ms since the second change
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1);
  });

  it('paused suppresses the debounce from firing', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    renderAutosave({ paused: true });
    act(() => vi.advanceTimersByTime(5000));
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
  });

  it('clears its pending timer on unmount', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    const { unmount } = renderAutosave();
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(drawingService.saveDrawing).not.toHaveBeenCalled();
  });
});

describe('useDrawingAutosave — Ctrl/Cmd+S', () => {
  it('saves immediately, bypassing the debounce', () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockResolvedValue({} as never);
    renderAutosave();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    });
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1);
  });
});

describe('useDrawingAutosave — retry with backoff', () => {
  it('retries once after a failed save, then succeeds', async () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({} as never);
    renderAutosave();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000); // debounce fires, first attempt fails
    });
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000); // backoff delay elapses
    });
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(2);
  });
});

describe('useDrawingAutosave — conflict', () => {
  it('calls onConflict, not onSaved, and does not retry, on a 409', async () => {
    vi.useFakeTimers();
    vi.mocked(drawingService.saveDrawing).mockRejectedValue(new DrawingConflictError());
    const onSaved = vi.fn();
    const onConflict = vi.fn();
    renderAutosave({ onSaved, onConflict });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(drawingService.saveDrawing).toHaveBeenCalledTimes(1); // no retry after a conflict
  });
});
