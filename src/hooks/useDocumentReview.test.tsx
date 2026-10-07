import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return { ...actual, documentExtractionService: { get: vi.fn() } };
});

import { derivePhase, useDocumentReview } from './useDocumentReview';
import { documentExtractionService as svc, ExtractionApiError } from '@/services/documentExtractionService';
import { draftKey } from '@/lib/documentReviewDraft';
import { extraction, resultDoc } from '@/test/documentExtractionFixtures';

function wrapper(url = '/sales/sales_order/new?fromDocument=ex-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>{children}</MemoryRouter></QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('derivePhase', () => {
  const ready = extraction(resultDoc());
  it.each([
    ['no id', false, undefined, null, false, 'off'],
    ['loading', true, undefined, null, true, 'loading'],
    ['ready', true, ready, null, false, 'ready'],
    ['running', true, { ...ready, status: 'running' as const }, null, false, 'loading'],
    ['used by status', true, { ...ready, status: 'used' as const }, null, false, 'used'],
    ['used by recordUuid', true, { ...ready, recordUuid: 'r1' }, null, false, 'used'],
    ['expired', true, undefined, new ExtractionApiError(404, 'gone', 'expired'), false, 'expired'],
    ['expired keeps data', true, ready, new ExtractionApiError(404, 'gone', 'expired'), false, 'expired'],
    ['other failure', true, undefined, new ExtractionApiError(500, 'boom'), false, 'unavailable'],
    ['discarded', true, { ...ready, status: 'discarded' as const }, null, false, 'unavailable'],
    ['failed to read', true, { ...ready, status: 'failed' as const }, null, false, 'failed'],
  ])('%s', (_n, hasId, data, error, pending, want) => {
    expect(derivePhase(hasId, data, error, pending)).toBe(want);
  });
});

describe('useDocumentReview', () => {
  it('stays off without ?fromDocument', () => {
    const { result } = renderHook(() => useDocumentReview({ a: 1 }), { wrapper: wrapper('/sales/sales_order/new') });
    expect(result.current.phase).toBe('off');
    expect(svc.get).not.toHaveBeenCalled();
  });

  it('loads a ready extraction', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    const { result } = renderHook(() => useDocumentReview({ a: 1 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current.extraction?.fileName).toBe('PO-4471.pdf');
  });

  it('reports used with the record to open', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(undefined, { status: 'used', recordUuid: 'so-9' }));
    const { result } = renderHook(() => useDocumentReview({}), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.phase).toBe('used'));
    expect(result.current.usedRecordUuid).toBe('so-9');
  });

  it('reports expired on 404 expired', async () => {
    vi.mocked(svc.get).mockRejectedValue(new ExtractionApiError(404, 'expired', 'expired'));
    const { result } = renderHook(() => useDocumentReview({}), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.phase).toBe('expired'));
  });

  it('reads a saved draft synchronously on mount', () => {
    window.sessionStorage.setItem(draftKey('ex-1'), JSON.stringify({ form: 'saved' }));
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    const { result } = renderHook(() => useDocumentReview<{ form: string }>({ form: 'new' }), { wrapper: wrapper() });
    expect(result.current.restoredDraft).toEqual({ form: 'saved' });
  });

  it('saves the snapshot after a 500ms debounce, only once hydrated, and stops after clearDraft', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(resultDoc()));
    const { result, rerender } = renderHook(({ s }) => useDocumentReview(s), {
      wrapper: wrapper(), initialProps: { s: { v: 1 } },
    });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    vi.useFakeTimers();

    rerender({ s: { v: 2 } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(window.sessionStorage.getItem(draftKey('ex-1'))).toBeNull(); // not hydrated yet

    act(() => { result.current.markHydrated(); });
    rerender({ s: { v: 3 } });
    act(() => { vi.advanceTimersByTime(499); });
    expect(window.sessionStorage.getItem(draftKey('ex-1'))).toBeNull();
    act(() => { vi.advanceTimersByTime(2); });
    expect(JSON.parse(window.sessionStorage.getItem(draftKey('ex-1')) ?? 'null')).toEqual({ v: 3 });

    act(() => { result.current.clearDraft(); });
    expect(window.sessionStorage.getItem(draftKey('ex-1'))).toBeNull();
    rerender({ s: { v: 4 } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(window.sessionStorage.getItem(draftKey('ex-1'))).toBeNull();
  });
});
