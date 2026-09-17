import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    unreadCount: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

import { NotificationBell } from './NotificationBell';
import { useAuthStore } from '@/store/useAuthStore';
import { notificationService } from '@/services/notificationService';

function mockAuth(state: { isAuthenticated: boolean; kind?: 'portal' }) {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(state),
  );
}

function renderBell(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<NotificationBell />, { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe('NotificationBell', () => {
  it('renders for a portal (customer) session, not just staff', async () => {
    mockAuth({ isAuthenticated: true, kind: 'portal' });
    vi.mocked(notificationService.unreadCount).mockResolvedValue(2);
    renderBell();

    expect(await screen.findByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('still renders for a staff session', async () => {
    mockAuth({ isAuthenticated: true, kind: undefined });
    vi.mocked(notificationService.unreadCount).mockResolvedValue(0);
    renderBell();

    expect(await screen.findByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('renders nothing when unauthenticated', () => {
    mockAuth({ isAuthenticated: false, kind: undefined });
    const { container } = renderBell();

    expect(container).toBeEmptyDOMElement();
  });

  // Regression guard for the "new notification doesn't show until I reload
  // the page" bug: the list query is gated by `enabled: enabled && open`, so
  // re-opening the dropdown must always refetch rather than serve the
  // app-wide 2-minute staleTime default (queryClient.ts) — otherwise a
  // notification created while the dropdown was closed stays invisible until
  // that window expires or the page is reloaded.
  it('refetches the list every time the dropdown re-opens, even within the app-wide staleTime window', async () => {
    mockAuth({ isAuthenticated: true, kind: undefined });
    vi.mocked(notificationService.unreadCount).mockResolvedValue(0);
    vi.mocked(notificationService.list).mockResolvedValue([]);

    // Mirrors the real app's default (src/lib/queryClient.ts) so this test
    // actually exercises the staleness window the bug lived in.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 2 * 60 * 1000 } },
    });
    renderBell(client);

    const toggle = await screen.findByRole('button', { name: /notifications/i });

    fireEvent.click(toggle);
    await waitFor(() => expect(notificationService.list).toHaveBeenCalledTimes(1));

    fireEvent.click(toggle); // close
    fireEvent.click(toggle); // re-open, well within the 2-minute staleTime window

    await waitFor(() => expect(notificationService.list).toHaveBeenCalledTimes(2));
  });
});
