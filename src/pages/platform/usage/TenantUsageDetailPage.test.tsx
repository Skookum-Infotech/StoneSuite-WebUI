import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import TenantUsageDetailPage from './TenantUsageDetailPage';
import { UsageNotAvailableError, platformUsageService } from '@/services/platformUsageService';
import { mockTenantUsage } from '@/lib/platformUsageMock';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { TenantUsageDetail } from '@/types/platformUsage';

function sample(id: string): TenantUsageDetail {
  const d = mockTenantUsage(id, '30d');
  if (!d) throw new Error(`no sample for ${id}`);
  return d;
}

function renderPage(path = '/platform/tenant-usage/t-acme') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/platform/tenant-usage/:tenantId" element={<TenantUsageDetailPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: { id: 'u1', email: 'admin@example.test', fullName: 'Admin', tenantId: 'owner', isPlatformAdmin: true },
  });
  useBreadcrumbStore.setState({ labels: {} });
  vi.mocked(platformUsageService.getTenantUsage).mockImplementation(async (id) => sample(id));
  vi.mocked(platformUsageService.ackAlert).mockResolvedValue();
});

describe('TenantUsageDetailPage', () => {
  it('shows the tenant, its eight metric cards and its sections', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Stone' })).toBeInTheDocument();
    const metrics = screen.getByRole('region', { name: 'Key metrics' });
    for (const label of ['Compute', 'Database storage', 'R2 storage', 'AI tokens', 'Active users', 'API requests', 'Error rate', 'p95 latency']) {
      expect(within(metrics).getByText(label)).toBeInTheDocument();
    }
    for (const heading of ['Compute over time', 'Storage over time', 'Largest tables', 'Activity', 'Alert history']) {
      expect(screen.getByRole('heading', { name: new RegExp(`^${heading}`) })).toBeInTheDocument();
    }
  });

  it('labels the breadcrumb with the tenant name, not the id', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Acme Stone' });
    await waitFor(() => expect(useBreadcrumbStore.getState().labels['t-acme']).toBe('Acme Stone'));
  });

  it('shows the open alert as a banner and snoozes it', async () => {
    renderPage();
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('R2 storage up 211% in 7 days');
    await userEvent.click(within(banner).getByRole('button', { name: /Acknowledge or snooze/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Acknowledge' }));
    expect(platformUsageService.ackAlert).toHaveBeenCalledWith('a-1', undefined);
    expect(toast.success).toHaveBeenCalledWith('Alert acknowledged');
  });

  it('links to the existing customer page', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: 'Open Acme Stone customer settings' });
    expect(link).toHaveAttribute('href', '/customer/onboarding/t-acme');
  });

  it("explains a 404 without saying whether the tenant exists", async () => {
    vi.mocked(platformUsageService.getTenantUsage).mockRejectedValue(new UsageNotAvailableError());
    renderPage('/platform/tenant-usage/unknown');
    expect(await screen.findByText("Usage isn't available for this tenant.")).toBeInTheDocument();
  });

  it('shows an empty state for a tenant with nothing measured', async () => {
    renderPage('/platform/tenant-usage/t-newtile');
    expect(await screen.findByText(/No usage yet/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Key metrics' })).not.toBeInTheDocument();
  });
});
