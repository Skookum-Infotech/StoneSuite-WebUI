import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/documentExtractionService', () => ({
  documentExtractionService: { proposeEntity: vi.fn() },
}));

import { useProposeEntity } from './useProposeEntity';
import { documentExtractionService } from '@/services/documentExtractionService';
import { makeProposedAction } from '@/test/proposedActionFixtures';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

beforeEach(() => vi.clearAllMocks());

describe('useProposeEntity', () => {
  it('calls the service and invalidates the extraction on success', async () => {
    const action = makeProposedAction();
    vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(action);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useProposeEntity('ext-1'), { wrapper });
    await act(async () => {
      expect(await result.current.mutateAsync({ key: 'k', overrides: { sku: 'S' } })).toBe(action);
    });
    expect(documentExtractionService.proposeEntity).toHaveBeenCalledWith('ext-1', 'k', { sku: 'S' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['document-extraction', 'ext-1'] });
  });

  it('also invalidates the extraction when the call fails', async () => {
    vi.mocked(documentExtractionService.proposeEntity).mockRejectedValue(new Error('boom'));
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useProposeEntity('ext-1'), { wrapper });
    await act(() => result.current.mutateAsync({ key: 'k' }).catch(() => undefined));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['document-extraction', 'ext-1'] });
  });
});
