import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHighlightOnCreate } from './useHighlightOnCreate';

const rowId = (id: string) => `row-${id}`;

function mountRow(id: string) {
  const el = document.createElement('div');
  el.id = rowId(id);
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useHighlightOnCreate', () => {
  it('does nothing before markCreated is called', () => {
    const { result } = renderHook(() => useHighlightOnCreate(rowId, null));
    expect(result.current.highlightedId).toBeNull();
  });

  it('scrolls to the row immediately when it already exists', () => {
    const el = mountRow('acct-1');
    const { result } = renderHook(() => useHighlightOnCreate(rowId, null));

    act(() => result.current.markCreated('acct-1'));

    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('marks the created id as highlighted right away', () => {
    mountRow('acct-1');
    const { result } = renderHook(() => useHighlightOnCreate(rowId, null));

    act(() => result.current.markCreated('acct-1'));

    expect(result.current.highlightedId).toBe('acct-1');
  });

  it('clears the highlight after the flash window', () => {
    vi.useFakeTimers();
    mountRow('acct-1');
    const { result } = renderHook(() => useHighlightOnCreate(rowId, null));

    act(() => result.current.markCreated('acct-1'));
    expect(result.current.highlightedId).toBe('acct-1');

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.highlightedId).toBeNull();
  });

  // The whole reason this hook exists rather than a bare scrollIntoView call:
  // the row is normally NOT in the DOM yet the moment markCreated fires (the
  // caller's query is still refetching in the background after invalidation).
  it('does not scroll when the row does not exist yet, then scrolls once `watch` reflects it', () => {
    const { result, rerender } = renderHook(
      ({ watch }: { watch: unknown }) => useHighlightOnCreate(rowId, watch),
      { initialProps: { watch: 'stale-data' } },
    );

    // Row not created yet — nothing to find, must not throw.
    expect(() => act(() => result.current.markCreated('acct-1'))).not.toThrow();

    // The background refetch "arrives": the row now exists, and the watched
    // value changes to reflect it.
    const el = mountRow('acct-1');
    rerender({ watch: 'fresh-data' });

    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('re-highlights when a second, different row is created', () => {
    vi.useFakeTimers();
    mountRow('acct-1');
    mountRow('acct-2');
    const { result } = renderHook(() => useHighlightOnCreate(rowId, null));

    act(() => result.current.markCreated('acct-1'));
    expect(result.current.highlightedId).toBe('acct-1');

    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.markCreated('acct-2'));
    expect(result.current.highlightedId).toBe('acct-2');
  });
});
