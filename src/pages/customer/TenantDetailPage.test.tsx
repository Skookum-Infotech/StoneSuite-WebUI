import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  platformService: {
    listTenants: vi.fn(),
    listJobs: vi.fn(),
    listInvites: vi.fn(),
    resendInvite: vi.fn(),
    retryJob: vi.fn(),
    lifecycle: vi.fn(),
    purgeTenant: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TenantDetailPage from './TenantDetailPage';
import { platformService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import type { AsyncJob, Tenant, TenantInvite } from '@/types/tenant';

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    slug: 'acme',
    displayName: 'Acme Stone Co.',
    status: 'active',
    migrationStatus: 'migrated',
    dbName: 'tenant_acme',
    r2Bucket: 'ss-acme',
    isPlatformOwner: false,
    createdAt: '2026-01-15T10:30:00Z',
    hardDeleteAfter: null,
    metadata: {
      company_name: 'Acme Stone Co.',
      super_admin_email: 'owner@acme.test',
      phone: '+1 555 0100',
      industry: 'Quarrying',
      website: 'acme.test',
      city: 'Austin',
    },
    ...overrides,
  };
}

const OTHER = makeTenant({ id: 't-2', slug: 'globex', displayName: 'Globex Inc.' });

const job: AsyncJob = {
  id: 'j-1',
  jobType: 'tenant.provision',
  status: 'failed',
  attempts: 3,
  maxAttempts: 3,
  lastError: 'database timeout',
  createdAt: '2026-01-15T10:31:00Z',
  updatedAt: '2026-01-15T10:35:00Z',
};

const invite: TenantInvite = {
  id: 'i-1',
  contactEmail: 'owner@acme.test',
  token: 'tok-abc-123',
  status: 'pending',
  expiresAt: '2030-01-01T00:00:00Z',
  createdAt: '2026-01-15T10:30:00Z',
  expired: false,
  inviteLink: 'https://app.test/apply/tok-abc-123',
};

function setUser(isPlatformAdmin: boolean) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'admin@skookum.test', fullName: 'Admin', tenantId: 'owner', isPlatformAdmin },
  });
}

function renderPage(path = '/customer/onboarding/t-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/customer/onboarding/:tenantId" element={<TenantDetailPage />} />
          <Route path="/customer/onboarding" element={<div>Customers list page</div>} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setUser(true);
  useBreadcrumbStore.setState({ labels: {} });
  vi.mocked(platformService.listTenants).mockResolvedValue([makeTenant(), OTHER]);
  vi.mocked(platformService.listJobs).mockResolvedValue([]);
  vi.mocked(platformService.listInvites).mockResolvedValue([]);
});

describe('TenantDetailPage — the customer and its details', () => {
  it('shows the customer it was opened for, not the others', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Acme Stone Co.' })).toBeInTheDocument();
    expect(screen.queryByText('Globex Inc.')).not.toBeInTheDocument();
  });

  it('lays out the overview: slug, database, bucket, migration and status', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Acme Stone Co.' });
    expect(screen.getByText('tenant_acme')).toBeInTheDocument();
    expect(screen.getByText('ss-acme')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('db migrated')).toBeInTheDocument();
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
  });

  it('shows the onboarding details: contact, industry, website and the extra fields', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Acme Stone Co.' });
    expect(screen.getByText('owner@acme.test')).toBeInTheDocument();
    expect(screen.getByText('+1 555 0100')).toBeInTheDocument();
    expect(screen.getByText('Quarrying')).toBeInTheDocument();
    expect(screen.getByText('acme.test')).toBeInTheDocument();
    expect(screen.getByText('Austin')).toBeInTheDocument();
  });

  it('shows provisioning jobs and invites for this customer only', async () => {
    vi.mocked(platformService.listJobs).mockResolvedValue([job]);
    vi.mocked(platformService.listInvites).mockResolvedValue([invite]);
    renderPage();

    expect(await screen.findByText('tenant.provision')).toBeInTheDocument();
    expect(screen.getByText('database timeout')).toBeInTheDocument();
    expect(await screen.findByText('tok-abc-123')).toBeInTheDocument();
    expect(platformService.listJobs).toHaveBeenCalledWith('t-1');
    expect(platformService.listInvites).toHaveBeenCalledWith('t-1');
  });

  it('links back to the customer list', async () => {
    renderPage();

    const back = await screen.findByRole('link', { name: /back to customers/i });
    expect(back).toHaveAttribute('href', '/customer/onboarding');
  });
});

describe('TenantDetailPage — breadcrumb', () => {
  it('labels the URL segment with the customer name, never the raw id, and clears it on leaving', async () => {
    const { unmount } = renderPage();

    await waitFor(() => expect(useBreadcrumbStore.getState().labels['t-1']).toBe('Acme Stone Co.'));

    unmount();
    expect(useBreadcrumbStore.getState().labels['t-1']).toBeUndefined();
  });
});

describe('TenantDetailPage — unhappy paths', () => {
  it('says so when the customer is not in the list (never existed, or already deleted)', async () => {
    renderPage('/customer/onboarding/t-404');

    expect(await screen.findByText(/customer not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to customers/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    vi.mocked(platformService.listTenants).mockRejectedValue(new Error('network down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
  });

  it('sends a non-platform-admin to the dashboard without fetching anything', async () => {
    setUser(false);
    renderPage();

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(platformService.listTenants).not.toHaveBeenCalled();
  });
});

describe('TenantDetailPage — lifecycle actions', () => {
  it('returns to the customer list once the customer is permanently deleted', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.purgeTenant).mockResolvedValue({ success: true });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete Acme Stone Co. permanently' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'acme');
    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

    expect(await screen.findByText('Customers list page')).toBeInTheDocument();
    expect(platformService.purgeTenant).toHaveBeenCalledWith('t-1', 'acme');
  });

  it('protects the platform owner workspace: a marker and no destructive buttons', async () => {
    vi.mocked(platformService.listTenants).mockResolvedValue([makeTenant({ isPlatformOwner: true })]);
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Acme Stone Co.' });
    expect(screen.getByText('Platform owner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspend|delete/i })).not.toBeInTheDocument();
  });
});
