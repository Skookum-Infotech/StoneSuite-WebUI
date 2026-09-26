import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/aiService', () => ({ getAIStatus: vi.fn() }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { useAIStatus } from './useAIStatus';
import { getAIStatus } from '@/services/aiService';
import { useAuthStore } from '@/store/useAuthStore';

function mockSession(isAuthenticated: boolean, kind?: 'portal') {
  const state = { isAuthenticated, kind };
  vi.mocked(useAuthStore).mockImplementation(((selector: (s: typeof state) => unknown) => selector(state)) as never);
}

function renderStatus() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAIStatus(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAIStatus', () => {
  it('fetches and returns the status for an authenticated staff session', async () => {
    mockSession(true);
    vi.mocked(getAIStatus).mockResolvedValue({ platformEnabled: true, tenantEnabled: true, available: true });

    const { result } = renderStatus();

    await waitFor(() => expect(result.current.data).toEqual({ platformEnabled: true, tenantEnabled: true, available: true }));
    expect(getAIStatus).toHaveBeenCalledTimes(1);
  });

  it('never fetches for an unauthenticated session', () => {
    mockSession(false);

    renderStatus();

    expect(getAIStatus).not.toHaveBeenCalled();
  });

  // The assistant lives under /api/tenant/*, which a customer-portal token
  // can never reach — fetching would just 403.
  it('never fetches for a customer-portal session', () => {
    mockSession(true, 'portal');

    renderStatus();

    expect(getAIStatus).not.toHaveBeenCalled();
  });
});
