import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/services/feedbackService', () => ({ feedbackService: { unreadCount: vi.fn() } }));

import { HelpMenu } from './HelpMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useHeaderMenuStore } from '@/store/useHeaderMenuStore';
import { feedbackService } from '@/services/feedbackService';

/** Test-only probe so assertions can read where the menu navigated to. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderHelpMenu(unreadTickets: number) {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ isAuthenticated: true, kind: undefined }),
  );
  vi.mocked(feedbackService.unreadCount).mockResolvedValue(unreadTickets);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sales/invoice']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <>
      <HelpMenu />
      <LocationProbe />
    </>,
    { wrapper },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The store is a module-level singleton, so it outlives any one render().
  useHeaderMenuStore.setState({ openMenu: null });
});

// Support used to open a popup from here; it is now a shortcut to /support.
describe('HelpMenu Support shortcut', () => {
  it('opens the Support page on the New Ticket tab when no reply is waiting', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(screen.getByRole('menuitem', { name: /Support/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/support?tab=new');
  });

  // The header dot is announcing an unread reply, so land where the reply is.
  it('opens the Support page on My Tickets when a reply is waiting', async () => {
    const user = userEvent.setup();
    renderHelpMenu(2);

    await user.click(await screen.findByRole('button', { name: 'Help (2 unread)' }));
    await user.click(screen.getByRole('menuitem', { name: /Support/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/support?tab=tickets');
  });

  it('closes the menu once Support is chosen', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(screen.getByRole('menuitem', { name: /Support/ }));

    expect(screen.queryByRole('menu', { name: /help menu/i })).not.toBeInTheDocument();
  });

  it('shows how many tickets have unread replies beside Support', async () => {
    const user = userEvent.setup();
    renderHelpMenu(2);

    await user.click(await screen.findByRole('button', { name: 'Help (2 unread)' }));

    expect(screen.getByRole('menuitem', { name: /Support/ })).toHaveTextContent('2');
  });
});
