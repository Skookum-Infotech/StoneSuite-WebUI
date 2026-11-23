import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/authService', () => ({
  authService: { getSessionStatus: vi.fn() },
}));

import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';
import { SESSION_REPLACED_MESSAGE } from '@/api/client';
import { useSessionWatch } from './useSessionWatch';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSessionWatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, kind: undefined, replacedSession: null });
  });

  it('shows the countdown once the server says the session was taken over', async () => {
    vi.mocked(authService.getSessionStatus).mockResolvedValue({
      success: true, status: 'replacing', endsInMs: 40_000, replacedBy: { at: 1, deviceLabel: 'Edge on Windows' },
    });
    renderHook(() => useSessionWatch(), { wrapper });

    await waitFor(() => expect(useAuthStore.getState().replacedSession).not.toBeNull());
    expect(useAuthStore.getState().replacedSession?.deviceLabel).toBe('Edge on Windows');
  });

  it('does nothing while the session is live', async () => {
    vi.mocked(authService.getSessionStatus).mockResolvedValue({ success: true, status: 'active' });
    renderHook(() => useSessionWatch(), { wrapper });

    await waitFor(() => expect(authService.getSessionStatus).toHaveBeenCalled());
    expect(useAuthStore.getState().replacedSession).toBeNull();
  });

  it('does not poll for a customer-portal session', async () => {
    useAuthStore.setState({ kind: 'portal' });
    renderHook(() => useSessionWatch(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(authService.getSessionStatus).not.toHaveBeenCalled();
  });

  it('shows the countdown when another tab of this browser found out first', async () => {
    vi.mocked(authService.getSessionStatus).mockResolvedValue({ success: true, status: 'active' });
    renderHook(() => useSessionWatch(), { wrapper });
    await waitFor(() => expect(authService.getSessionStatus).toHaveBeenCalled());

    const other = new BroadcastChannel('session-sync');
    other.postMessage({ type: SESSION_REPLACED_MESSAGE, info: { deviceLabel: 'Chrome on Windows' } });
    other.close();

    await waitFor(() => expect(useAuthStore.getState().replacedSession?.deviceLabel).toBe('Chrome on Windows'));
  });
});
