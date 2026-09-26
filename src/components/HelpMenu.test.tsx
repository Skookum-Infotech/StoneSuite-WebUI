import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fragment, StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type * as AiServiceModule from '@/services/aiService';
import type * as AuthStoreModule from '@/store/useAuthStore';

vi.mock('@/store/useAuthStore', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthStoreModule>();
  const useAuthStore = vi.fn() as unknown as typeof actual.useAuthStore;
  // useAssistantConversation derives its identity key (and localStorage
  // entry) from the useAuthStore selector, same as HelpMenu's own `isPortal`
  // read below — both go through the same mocked hook, set per-test in
  // renderHelpMenu(). getState() is stubbed too, defensively, in case
  // anything reachable from render still reads it directly.
  (useAuthStore as unknown as { getState: () => unknown }).getState = () => ({ user: undefined });
  return { ...actual, useAuthStore };
});
vi.mock('@/services/feedbackService', () => ({ feedbackService: { unreadCount: vi.fn() } }));
vi.mock('@/services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof AiServiceModule>()),
  getAIStatus: vi.fn(),
  warmAssistant: vi.fn(),
  conversationService: { create: vi.fn(), list: vi.fn(), get: vi.fn(), remove: vi.fn() },
}));

import { HelpMenu } from './HelpMenu';
import { useAuthStore } from '@/store/useAuthStore';
import { useHeaderMenuStore } from '@/store/useHeaderMenuStore';
import { feedbackService } from '@/services/feedbackService';
import { getAIStatus, warmAssistant } from '@/services/aiService';
import type { AIStatus } from '@/types/ai';

/** Test-only probe so assertions can read where the menu navigated to. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderHelpMenu(unreadTickets: number, kind?: 'portal', status?: Partial<AIStatus> | 'pending', strict = false) {
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
  vi.mocked(warmAssistant).mockResolvedValue(undefined);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Body = strict ? StrictMode : Fragment;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sales/invoice']}>
        <Body>{children}</Body>
      </MemoryRouter>
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

// Fake epochs well past any real Date.now() a test in this file could
// observe, and spaced 30 minutes apart — comfortably more than the 5-minute
// throttle window plus whatever a given test itself advances by — so the
// module-level warm throttle (shared across every test in this file) never
// bleeds from one test into the next.
const WARM_EPOCH_BASE = 2_000_000_000_000;
const WARM_EPOCH_STEP = 30 * 60_000;
const warmEpoch = (i: number): number => WARM_EPOCH_BASE + i * WARM_EPOCH_STEP;

describe('warms the assistant when the Help menu opens (HIGH #6)', () => {
  it('warms the assistant once the menu is opened while it is available', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(warmEpoch(0));
    try {
      const user = userEvent.setup();
      renderHelpMenu(0, undefined, { available: true });

      await user.click(screen.getByRole('button', { name: 'Help' }));

      expect(warmAssistant).toHaveBeenCalledTimes(1);
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('does not warm when the assistant is unavailable', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(warmEpoch(1));
    try {
      const user = userEvent.setup();
      renderHelpMenu(0, undefined, { available: false });

      await user.click(screen.getByRole('button', { name: 'Help' }));

      expect(warmAssistant).not.toHaveBeenCalled();
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('does not warm again within 5 minutes of the last warm', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(warmEpoch(2));
    try {
      const user = userEvent.setup();
      renderHelpMenu(0, undefined, { available: true });

      await user.click(screen.getByRole('button', { name: 'Help' })); // open: warms
      await user.click(screen.getByRole('button', { name: 'Help' })); // close
      dateSpy.mockReturnValue(warmEpoch(2) + 60_000); // +1 minute, still inside the window
      await user.click(screen.getByRole('button', { name: 'Help' })); // reopen: throttled

      expect(warmAssistant).toHaveBeenCalledTimes(1);
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('warms again once 5 minutes have passed', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(warmEpoch(3));
    try {
      const user = userEvent.setup();
      renderHelpMenu(0, undefined, { available: true });

      await user.click(screen.getByRole('button', { name: 'Help' })); // open: warms
      await user.click(screen.getByRole('button', { name: 'Help' })); // close
      dateSpy.mockReturnValue(warmEpoch(3) + 6 * 60_000); // past the 5-minute window
      await user.click(screen.getByRole('button', { name: 'Help' })); // reopen: warms again

      expect(warmAssistant).toHaveBeenCalledTimes(2);
    } finally {
      dateSpy.mockRestore();
    }
  });

  // React StrictMode double-invokes effects in dev to surface missing
  // cleanup — the module-level timestamp (not a ref, which StrictMode would
  // reset between the two invocations) must still only let one call through.
  it('fires only once under StrictMode\'s double-invoked effects', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(warmEpoch(4));
    try {
      const user = userEvent.setup();
      renderHelpMenu(0, undefined, { available: true }, true);

      await user.click(screen.getByRole('button', { name: 'Help' }));

      expect(warmAssistant).toHaveBeenCalledTimes(1);
    } finally {
      dateSpy.mockRestore();
    }
  });
});
