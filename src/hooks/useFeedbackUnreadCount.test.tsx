import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/feedbackService', () => ({ feedbackService: { unreadCount: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { useFeedbackUnreadCount } from './useFeedbackUnreadCount';
import { feedbackService } from '@/services/feedbackService';
import { useAuthStore } from '@/store/useAuthStore';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function mockSession(isAuthenticated: boolean) {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ isAuthenticated }),
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('useFeedbackUnreadCount', () => {
  it('reports how many of the caller\'s tickets have unread replies', async () => {
    mockSession(true);
    vi.mocked(feedbackService.unreadCount).mockResolvedValue(3);

    const { result } = renderHook(() => useFeedbackUnreadCount(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current).toBe(3));
  });

  // Callers render the value straight into a badge, so it must be a number
  // (never undefined) while the first request is still in flight.
  it('reads 0 until the first response arrives', () => {
    mockSession(true);
    vi.mocked(feedbackService.unreadCount).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useFeedbackUnreadCount(), { wrapper: makeWrapper() });

    expect(result.current).toBe(0);
  });

  // A signed-out request can only 401.
  it('does not call the API while signed out', () => {
    mockSession(false);

    renderHook(() => useFeedbackUnreadCount(), { wrapper: makeWrapper() });

    expect(feedbackService.unreadCount).not.toHaveBeenCalled();
  });

  // Without polling an admin's reply would only show up after a full reload.
  it('polls again after a minute while the session stays open', async () => {
    vi.useFakeTimers();
    mockSession(true);
    vi.mocked(feedbackService.unreadCount).mockResolvedValue(0);

    renderHook(() => useFeedbackUnreadCount(), { wrapper: makeWrapper() });
    await vi.advanceTimersByTimeAsync(0);
    expect(feedbackService.unreadCount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);

    expect(feedbackService.unreadCount).toHaveBeenCalledTimes(2);
  });
});
