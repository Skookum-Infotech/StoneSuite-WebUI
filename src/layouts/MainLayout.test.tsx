import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Everything mocked here is either heavy or API-backed and has its own tests.
// What this file pins is MainLayout's own wiring: who it lets through, and
// what it remembers about where the user has been.
vi.mock('@/components/Sidebar', () => ({ default: () => null }));
vi.mock('@/components/GlobalSearch', () => ({ GlobalSearch: () => null }));
vi.mock('@/components/HelpMenu', () => ({ HelpMenu: () => null }));
vi.mock('@/components/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/TenantLogoMark', () => ({ TenantLogoMark: () => null }));
vi.mock('@/hooks/useSessionTimer', () => ({
  useSessionTimer: () => ({
    showWarning: false,
    secondsRemaining: 0,
    onStay: vi.fn(),
    onLogout: vi.fn(),
    isExtending: false,
  }),
}));
vi.mock('@/hooks/useExitConfirmation', () => ({
  useExitConfirmation: () => ({ isPrompting: false, dismiss: vi.fn() }),
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ activeRoleId: '' }) }));

import MainLayout from './MainLayout';
import { useAuthStore } from '@/store/useAuthStore';
import { useLastAppPathStore } from '@/store/useLastAppPathStore';
import type { UserProfile } from '@/types/auth';

const TEST_USER = { id: 'u1', email: 'a@b.com', fullName: 'A B' } as UserProfile;
const SESSION_MS = 60_000;

function signInAsStaff() {
  useAuthStore.getState().setAuth(TEST_USER, 'token', Date.now() + SESSION_MS);
}

function signInAsCustomer() {
  useAuthStore.getState().setPortalAuth({
    user: TEST_USER,
    token: 'token',
    expiresAt: Date.now() + SESSION_MS,
    tenantId: 'tenant-1',
    // Non-empty so MainLayout does not try to fetch the workspace list itself.
    workspaces: [{ tenantId: 'tenant-1', name: 'Acme', slug: 'acme', active: true }],
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { path: 'dashboard', element: <div>Dashboard page</div> },
          { path: 'sales/sales_order', element: <div>Sales orders page</div> },
          { path: 'sales/invoice/:id', element: <div>Invoice page</div> },
          { path: 'support', element: <div>Support page</div> },
          { path: 'finance/journal-entries', element: <div>Journal entries page</div> },
          { path: 'finance/journal-entries/:id', element: <div>Journal entry page</div> },
        ],
      },
      { path: '/auth/login', element: <div>Sign in</div> },
      // Same catch-all the real router ends with — where a dead crumb would land.
      { path: '*', element: <div>404 - Not Found</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().logout();
  // The store is a module-level singleton, so it outlives any one render().
  useLastAppPathStore.setState({ path: '' });
});

describe('MainLayout customer-portal allowlist', () => {
  // A customer could file tickets from the old header popup; the Support page
  // must be reachable for them, not bounced to Sales Orders.
  it('lets a customer-portal session open Support', () => {
    signInAsCustomer();

    renderAt('/support');

    expect(screen.getByText('Support page')).toBeInTheDocument();
    expect(screen.queryByText('Sales orders page')).not.toBeInTheDocument();
  });

  // Guards the allowlist itself: adding Support must not open the staff pages.
  it('still sends a customer-portal session away from staff-only pages', () => {
    signInAsCustomer();

    renderAt('/dashboard');

    expect(screen.getByText('Sales orders page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });

  it('lets a staff session open Support', () => {
    signInAsStaff();

    renderAt('/support');

    expect(screen.getByText('Support page')).toBeInTheDocument();
  });
});

describe('MainLayout breadcrumb links', () => {
  function breadcrumb() {
    return within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
  }

  // "Finance" is only a sidebar group — there is no /finance page, so a click
  // used to land on the bare 404 route instead of doing nothing.
  it('does not navigate when a group crumb with no page of its own is clicked', async () => {
    signInAsStaff();
    const router = renderAt('/finance/journal-entries');

    await userEvent.click(breadcrumb().getByText('Finance'));

    expect(router.state.location.pathname).toBe('/finance/journal-entries');
    expect(screen.queryByText('404 - Not Found')).not.toBeInTheDocument();
    expect(screen.getByText('Journal entries page')).toBeInTheDocument();
  });

  // Guards the other direction: gating on the route table must not turn every
  // crumb inert (e.g. if the router context stops being readable).
  it('still navigates when a crumb whose page exists is clicked', async () => {
    signInAsStaff();
    const router = renderAt('/finance/journal-entries/9');

    await userEvent.click(breadcrumb().getByText('Journal Entries'));

    expect(router.state.location.pathname).toBe('/finance/journal-entries');
    expect(screen.getByText('Journal entries page')).toBeInTheDocument();
  });
});

describe('MainLayout last-page tracking', () => {
  // Tickets are filed from /support; this is what lets them still say which
  // page the reporter was actually on when something went wrong.
  it('remembers the page the user was on once they open Support', async () => {
    signInAsStaff();
    const router = renderAt('/sales/invoice/9?tab=lines');

    await act(async () => {
      await router.navigate('/support?tab=submit');
    });

    expect(screen.getByText('Support page')).toBeInTheDocument();
    expect(useLastAppPathStore.getState().path).toBe('/sales/invoice/9?tab=lines');
  });
});
