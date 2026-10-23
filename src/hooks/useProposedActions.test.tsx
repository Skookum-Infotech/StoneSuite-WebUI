import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/proposedActionService', () => ({
  proposedActionService: { list: vi.fn(), get: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}));

import {
  RESOURCE_QUERY_KEYS,
  useCancelProposedAction,
  useConfirmProposedAction,
  useProposedActions,
} from './useProposedActions';
import { proposedActionService } from '@/services/proposedActionService';
import { makeProposedAction } from '@/test/proposedActionFixtures';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete RESOURCE_QUERY_KEYS.customer;
});

describe('useProposedActions', () => {
  it('returns only pending actions', async () => {
    const pending = makeProposedAction({ id: 'p' });
    const done = makeProposedAction({ id: 'd', status: 'confirmed' });
    vi.mocked(proposedActionService.list).mockResolvedValue({ actions: [pending, done], nextCursor: '' });
    const { wrapper } = setup();
    const { result } = renderHook(() => useProposedActions(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([pending]));
    expect(proposedActionService.list).toHaveBeenCalledWith({ limit: 25 });
  });
});

describe('useConfirmProposedAction', () => {
  it('invalidates the actions keys after a successful confirm', async () => {
    const a = makeProposedAction({ status: 'confirmed' });
    vi.mocked(proposedActionService.confirm).mockResolvedValue({ action: a, replayed: false, message: '' });
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useConfirmProposedAction(), { wrapper });
    await act(() => result.current.mutateAsync('pa-1'));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions', 'detail', 'pa-1'] });
  });

  it('also invalidates registered keys for the confirmed record\'s resource', async () => {
    RESOURCE_QUERY_KEYS.customer = [['crm-records', 'customer']];
    const a = makeProposedAction({
      status: 'confirmed',
      resultRef: { resource: 'customer', recordId: 'r1', label: 'Acme' },
    });
    vi.mocked(proposedActionService.confirm).mockResolvedValue({ action: a, replayed: false, message: '' });
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useConfirmProposedAction(), { wrapper });
    await act(() => result.current.mutateAsync('pa-1'));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['crm-records', 'customer'] });
  });

  it('refreshes the actions list (not the resource) when confirm fails', async () => {
    RESOURCE_QUERY_KEYS.customer = [['crm-records', 'customer']];
    vi.mocked(proposedActionService.confirm).mockRejectedValue(new Error('boom'));
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useConfirmProposedAction(), { wrapper });
    await act(() => result.current.mutateAsync('pa-1').catch(() => undefined));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions'] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['crm-records', 'customer'] });
  });
});

describe('useConfirmProposedAction 404', () => {
  it('invalidates the actions queries so the stale card disappears', async () => {
    const err = Object.assign(new Error('not found'), { response: { status: 404 } });
    vi.mocked(proposedActionService.confirm).mockRejectedValue(err);
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useConfirmProposedAction(), { wrapper });
    await act(() => result.current.mutateAsync('pa-1').catch(() => undefined));
    // The ['proposed-actions'] root prefix-matches both list and detail keys.
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions'] });
  });
});

describe('useCancelProposedAction', () => {
  it('invalidates the actions keys after cancel', async () => {
    vi.mocked(proposedActionService.cancel).mockResolvedValue(makeProposedAction({ status: 'cancelled' }));
    const { wrapper, spy } = setup();
    const { result } = renderHook(() => useCancelProposedAction(), { wrapper });
    await act(() => result.current.mutateAsync('pa-1'));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposed-actions', 'detail', 'pa-1'] });
  });
});
