import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentExtractionService', () => ({
  documentExtractionService: { get: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { dismiss: vi.fn() } }));

import { toast } from 'sonner';
import { backgroundToastId, trackBackgroundExtraction, useBackgroundExtractionWatch } from './useBackgroundExtractions';
import { PENDING_DOCUMENTS_KEY } from '@/lib/documentExtractionKeys';
import { documentExtractionService as svc } from '@/services/documentExtractionService';
import type { DocumentExtraction } from '@/types/documentExtraction';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, invalidate, wrapper };
}

const pendingRefreshed = (invalidate: ReturnType<typeof setup>['invalidate']): boolean =>
  invalidate.mock.calls.some(([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(PENDING_DOCUMENTS_KEY));

beforeEach(() => vi.clearAllMocks());

describe('useBackgroundExtractionWatch', () => {
  it('refreshes pending documents once a backgrounded extraction is ready', async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'ready' } as DocumentExtraction);
    const { client, invalidate, wrapper } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    renderHook(() => useBackgroundExtractionWatch(true), { wrapper });
    await waitFor(() => expect(pendingRefreshed(invalidate)).toBe(true));
    await waitFor(() => expect(client.getQueryData(['document-extractions', 'background'])).toEqual([]));
  });

  it("dismisses the stale \"we'll notify you\" toast once the extraction settles", async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'ready' } as DocumentExtraction);
    const { client, wrapper } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    renderHook(() => useBackgroundExtractionWatch(true), { wrapper });
    await waitFor(() => expect(toast.dismiss).toHaveBeenCalledWith(backgroundToastId('ex-1')));
  });

  it('keeps watching while the extraction is still running', async () => {
    vi.mocked(svc.get).mockResolvedValue({ id: 'ex-1', status: 'running' } as DocumentExtraction);
    const { client, invalidate, wrapper } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    renderHook(() => useBackgroundExtractionWatch(true), { wrapper });
    await waitFor(() => expect(svc.get).toHaveBeenCalledWith('ex-1'));
    expect(pendingRefreshed(invalidate)).toBe(false);
    expect(client.getQueryData(['document-extractions', 'background'])).toEqual(['ex-1']);
    expect(toast.dismiss).not.toHaveBeenCalled();
  });

  it('stops watching an extraction that can no longer be read', async () => {
    vi.mocked(svc.get).mockRejectedValue(new Error('gone'));
    const { client, wrapper } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    renderHook(() => useBackgroundExtractionWatch(true), { wrapper });
    await waitFor(() => expect(client.getQueryData(['document-extractions', 'background'])).toEqual([]));
  });

  it('does not poll when disabled', () => {
    const { client, wrapper } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    renderHook(() => useBackgroundExtractionWatch(false), { wrapper });
    expect(svc.get).not.toHaveBeenCalled();
  });

  it('tracks an id once', () => {
    const { client } = setup();
    trackBackgroundExtraction(client, 'ex-1');
    trackBackgroundExtraction(client, 'ex-1');
    expect(client.getQueryData(['document-extractions', 'background'])).toEqual(['ex-1']);
  });
});
