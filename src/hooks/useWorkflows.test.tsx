import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/tenantServices', () => ({ workflowService: { listEnabled: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { useWorkflows } from './useWorkflows';
import { workflowService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockKind(kind?: 'portal') {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ kind }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('useWorkflows', () => {
  // The regression this test suite exists for: a portal session used to
  // never call workflowService.listEnabled at all (query `enabled: !isPortal`)
  // and hardcoded isWorkflowEnabled to always return true. Both are gone now.
  it('fetches workflow status for a portal session', async () => {
    mockKind('portal');
    vi.mocked(workflowService.listEnabled).mockResolvedValue([]);

    renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(workflowService.listEnabled).toHaveBeenCalledTimes(1));
  });

  it('blocks a workflow a portal session was told is disabled', async () => {
    mockKind('portal');
    vi.mocked(workflowService.listEnabled).mockResolvedValue([{ key: 'invoice', enabled: false }]);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isWorkflowEnabled('invoice')).toBe(false);
  });

  it('fails open for a portal session when the request fails (e.g. route not deployed yet)', async () => {
    mockKind('portal');
    vi.mocked(workflowService.listEnabled).mockRejectedValue(new Error('404'));

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isWorkflowEnabled('invoice')).toBe(true);
  });

  it('fails open for a key the server did not return', async () => {
    mockKind('portal');
    vi.mocked(workflowService.listEnabled).mockResolvedValue([{ key: 'invoice', enabled: false }]);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isWorkflowEnabled('payment')).toBe(true);
  });

  it('reports real loading state for a portal session', () => {
    mockKind('portal');
    vi.mocked(workflowService.listEnabled).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('behaves the same for a staff session (no regression)', async () => {
    mockKind(undefined);
    vi.mocked(workflowService.listEnabled).mockResolvedValue([{ key: 'lead', enabled: false }]);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isWorkflowEnabled('lead')).toBe(false);
    expect(result.current.isWorkflowEnabled('quote')).toBe(true);
  });
});
