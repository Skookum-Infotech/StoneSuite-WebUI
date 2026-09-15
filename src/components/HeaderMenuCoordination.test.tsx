import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Reproduces the reported bug: opening the Help menu, then the Notifications
// bell, left both dropdowns open and stacked on top of each other in the
// header's top-right corner, because each kept its own independent open
// state and the trigger buttons' e.stopPropagation() kept a sibling menu's
// "click outside closes" window listener from ever firing.
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/services/notificationService', () => ({
  notificationService: {
    unreadCount: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));
vi.mock('@/services/feedbackService', () => ({
  feedbackService: {
    unreadCount: vi.fn(),
  },
}));

import { HelpMenu } from './HelpMenu';
import { NotificationBell } from './NotificationBell';
import { useAuthStore } from '@/store/useAuthStore';
import { useHeaderMenuStore } from '@/store/useHeaderMenuStore';
import { notificationService } from '@/services/notificationService';
import { feedbackService } from '@/services/feedbackService';

function renderHeaderIcons() {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ isAuthenticated: true, kind: undefined }),
  );
  vi.mocked(notificationService.unreadCount).mockResolvedValue(0);
  vi.mocked(notificationService.list).mockResolvedValue([]);
  vi.mocked(feedbackService.unreadCount).mockResolvedValue(0);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <>
      <HelpMenu />
      <NotificationBell />
    </>,
    { wrapper },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The store is a module-level singleton, so it outlives any one render()
  // and must be reset explicitly between tests.
  useHeaderMenuStore.setState({ openMenu: null });
});

describe('header icon dropdown coordination', () => {
  it('closes the Help menu when the Notifications bell is opened', async () => {
    const user = userEvent.setup();
    renderHeaderIcons();

    await user.click(await screen.findByRole('button', { name: /help/i }));
    expect(await screen.findByRole('menu', { name: /help menu/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /notifications/i }));
    expect(await screen.findByRole('menu', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: /help menu/i })).not.toBeInTheDocument();
  });

  it('closes the Notifications menu when the Help icon is opened', async () => {
    const user = userEvent.setup();
    renderHeaderIcons();

    await user.click(await screen.findByRole('button', { name: /notifications/i }));
    expect(await screen.findByRole('menu', { name: /notifications/i })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /help/i }));
    expect(await screen.findByRole('menu', { name: /help menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: /notifications/i })).not.toBeInTheDocument();
  });
});
