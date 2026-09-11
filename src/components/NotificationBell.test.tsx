import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
});
