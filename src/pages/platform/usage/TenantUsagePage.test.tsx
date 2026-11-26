import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as ServiceModule from '@/services/platformUsageService';

vi.mock('@/services/platformUsageService', async (importOriginal) => {
  const actual = await importOriginal<typeof ServiceModule>();
  return {
    ...actual,
    PLATFORM_USAGE_MOCK: false,
    platformUsageService: { getOverview: vi.fn(), getWatchlist: vi.fn(), getTenantUsage: vi.fn(), ackAlert: vi.fn() },
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import TenantUsagePage from './TenantUsagePage';
import { platformUsageService } from '@/services/platformUsageService';
import { mockOverview, mockWatchlist } from '@/lib/platformUsageMock';
import { useAuthStore } from '@/store/useAuthStore';

function setUser(isPlatformAdmin: boolean) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'admin@example.test', fullName: 'Admin', tenantId: 'owner', isPlatformAdmin },
  });
}

function renderPage(path = '/platform/tenant-usage') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/platform/tenant-usage" element={<TenantUsagePage />} />
          <Route path="/platform/tenant-usage/:tenantId" element={<div>Tenant detail page</div>} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setUser(true);
  vi.mocked(platformUsageService.getOverview).mockImplementation(async (p) => mockOverview(p));
  vi.mocked(platformUsageService.getWatchlist).mockResolvedValue(mockWatchlist());
  vi.mocked(platformUsageService.ackAlert).mockResolvedValue();
});

describe('TenantUsagePage', () => {
  it('shows the fleet totals and every tenant', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenant Usage' })).toBeInTheDocument();
    const totals = await screen.findByRole('region', { name: 'Fleet totals' });
    expect(within(totals).getByText('Active tenants')).toBeInTheDocument();
    expect(screen.getAllByRole('row', { name: /^Open usage for / })).toHaveLength(10);
  });

  it('lists watch-list alerts most severe first', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Alerts' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Critical');
    expect(items[items.length - 1]).toHaveTextContent('Info');
    expect(screen.getByRole('heading', { name: `Watch list (${items.length})` })).toBeInTheDocument();
  });

  it('says all clear when nothing needs attention', async () => {
    vi.mocked(platformUsageService.getWatchlist).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('All clear. No tenants need attention.')).toBeInTheDocument();
  });

  it('acknowledges an alert from the menu and confirms with a toast', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Alerts' });
    const first = within(list).getAllByRole('listitem')[0];
    await userEvent.click(within(first).getByRole('button', { name: /Acknowledge or snooze/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Snooze for 7 days' }));
    expect(platformUsageService.ackAlert).toHaveBeenCalledWith(expect.any(String), 7);
    expect(toast.success).toHaveBeenCalledWith('Alert snoozed for 7 days');
  });

  it('filters the table by search', async () => {
    renderPage();
    await screen.findAllByRole('row', { name: /^Open usage for / });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tenants' }), 'granite');
    expect(screen.getAllByRole('row', { name: /^Open usage for / })).toHaveLength(1);
    expect(screen.getByText('Showing 1 of 10 tenants')).toBeInTheDocument();
  });

  it('sorts by a column header', async () => {
    renderPage();
    await screen.findAllByRole('row', { name: /^Open usage for / });
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Tenant' }));
    const rows = screen.getAllByRole('row', { name: /^Open usage for / });
    expect(rows[0]).toHaveAccessibleName('Open usage for Acme Stone');
  });

  it('opens a tenant when its row is chosen with the keyboard', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: 'Open usage for Granite Co' });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Tenant detail page')).toBeInTheDocument();
  });

  it('reloads with the chosen period', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('radio', { name: 'Last 7 days' }));
    expect(platformUsageService.getOverview).toHaveBeenLastCalledWith('7d');
  });

  it('sends a non-platform-admin to the dashboard', async () => {
    setUser(false);
    renderPage();
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(platformUsageService.getOverview).not.toHaveBeenCalled();
  });
});
