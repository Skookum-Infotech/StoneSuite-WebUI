import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type * as AiServiceModule from '@/services/aiService';

vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/services/feedbackService', () => ({ feedbackService: { unreadCount: vi.fn() } }));
vi.mock('@/services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof AiServiceModule>()),
  getAIStatus: vi.fn(),
}));

import { HelpMenu } from './HelpMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useHeaderMenuStore } from '@/store/useHeaderMenuStore';
import { feedbackService } from '@/services/feedbackService';
import { getAIStatus } from '@/services/aiService';
import type { AIStatus } from '@/types/ai';

/** Test-only probe so assertions can read where the menu navigated to. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderHelpMenu(unreadTickets: number, kind?: 'portal', status?: Partial<AIStatus> | 'pending') {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ isAuthenticated: true, kind }),
  );
  vi.mocked(feedbackService.unreadCount).mockResolvedValue(unreadTickets);
  if (status === 'pending') {
    vi.mocked(getAIStatus).mockReturnValue(new Promise(() => {}));
  } else {
    vi.mocked(getAIStatus).mockResolvedValue({
      platformEnabled: true,
      tenantEnabled: true,
      available: true,
      ...status,
    });
  }

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

// The assistant lives under /api/tenant/*, which a customer-portal token can
// never reach — offering it there only produced a 403 on the first question.
describe('HelpMenu assistant entry', () => {
  it('offers the assistant to staff when it is available', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0, undefined, { available: true });

    await user.click(screen.getByRole('button', { name: 'Help' }));

    expect(await screen.findByRole('menuitem', { name: /StoneSuite Assistant/ })).toBeInTheDocument();
  });

  it('hides the assistant from customer-portal sessions', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0, 'portal');

    await user.click(screen.getByRole('button', { name: 'Help' }));

    expect(screen.queryByRole('menuitem', { name: /StoneSuite Assistant/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Support/ })).toBeInTheDocument();
    expect(getAIStatus).not.toHaveBeenCalled();
  });

  // Neither the platform master switch nor the tenant's own switch is on —
  // available is the AND of both, computed server-side.
  it('hides the assistant when the platform or tenant switch is off', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0, undefined, { available: false });

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('menuitem', { name: /Support/ });

    expect(screen.queryByRole('menuitem', { name: /StoneSuite Assistant/ })).not.toBeInTheDocument();
  });

  // Flashing the item on and then off once the real status lands would be
  // more distracting than a brief absence.
  it('hides the assistant while its status is still loading', async () => {
    const user = userEvent.setup();
    renderHelpMenu(0, undefined, 'pending');

    await user.click(screen.getByRole('button', { name: 'Help' }));

    expect(screen.queryByRole('menuitem', { name: /StoneSuite Assistant/ })).not.toBeInTheDocument();
  });
});
