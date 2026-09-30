import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  platformService: { lifecycle: vi.fn(), purgeTenant: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TenantActions } from './TenantActions';
import { platformService } from '@/services/tenantServices';
import { toast } from 'sonner';
import type { Tenant } from '@/types/tenant';

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    slug: 'acme',
    displayName: 'Acme Stone Co.',
    status: 'active',
    migrationStatus: 'ok',
    dbName: 'tenant_acme',
    r2Bucket: 'ss-acme',
    isPlatformOwner: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderActions(tenant: Tenant, onPurged?: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <TenantActions tenant={tenant} onPurged={onPurged} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const suspendBtn = () => screen.queryByRole('button', { name: 'Suspend Acme Stone Co.' });
const restoreBtn = () => screen.queryByRole('button', { name: 'Restore Acme Stone Co.' });
const deleteBtn = () => screen.queryByRole('button', { name: 'Delete Acme Stone Co. permanently' });
const getSuspend = () => screen.getByRole('button', { name: 'Suspend Acme Stone Co.' });
const getRestore = () => screen.getByRole('button', { name: 'Restore Acme Stone Co.' });
const getDelete = () => screen.getByRole('button', { name: 'Delete Acme Stone Co. permanently' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TenantActions — which buttons appear', () => {
  it('active: Suspend and Delete, no Restore', () => {
    renderActions(makeTenant({ status: 'active' }));

    expect(suspendBtn()).toBeInTheDocument();
    expect(deleteBtn()).toBeInTheDocument();
    expect(restoreBtn()).not.toBeInTheDocument();
  });

  it('suspended: Restore and Delete, no Suspend', () => {
    renderActions(makeTenant({ status: 'suspended' }));

    expect(restoreBtn()).toBeInTheDocument();
    expect(deleteBtn()).toBeInTheDocument();
    expect(suspendBtn()).not.toBeInTheDocument();
  });

  it('provisioning: nothing, a purge would race the provisioning job', () => {
    renderActions(makeTenant({ status: 'provisioning' }));

    expect(suspendBtn()).not.toBeInTheDocument();
    expect(restoreBtn()).not.toBeInTheDocument();
    expect(deleteBtn()).not.toBeInTheDocument();
  });

  it('platform owner: no buttons, just a protected marker', () => {
    renderActions(makeTenant({ isPlatformOwner: true }));

    expect(suspendBtn()).not.toBeInTheDocument();
    expect(deleteBtn()).not.toBeInTheDocument();
    expect(screen.getByText('Platform owner')).toBeInTheDocument();
  });
});

describe('TenantActions — suspend', () => {
  it('asks for confirmation, then suspends and refreshes the list', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.lifecycle).mockResolvedValue({ success: true });
    const { invalidate } = renderActions(makeTenant());

    await user.click(getSuspend());
    const dialog = screen.getByRole('dialog', { name: /suspend acme stone co\.\?/i });
    expect(platformService.lifecycle).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(platformService.lifecycle).toHaveBeenCalledWith('t-1', 'suspend'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenants'] });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Acme Stone Co.'));
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderActions(makeTenant());

    await user.click(getSuspend());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(platformService.lifecycle).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows the error when suspending fails', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.lifecycle).mockRejectedValue(new Error('Lifecycle action failed.'));
    renderActions(makeTenant());

    await user.click(getSuspend());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Lifecycle action failed.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('TenantActions — restore', () => {
  it('restores in one click, since reactivating is harmless', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.lifecycle).mockResolvedValue({ success: true });
    const { invalidate } = renderActions(makeTenant({ status: 'suspended' }));

    await user.click(getRestore());

    await waitFor(() => expect(platformService.lifecycle).toHaveBeenCalledWith('t-1', 'restore'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenants'] }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Acme Stone Co.'));
  });

  it('reports a failed restore instead of failing silently', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.lifecycle).mockRejectedValue(new Error('Lifecycle action failed.'));
    renderActions(makeTenant({ status: 'suspended' }));

    await user.click(getRestore());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Lifecycle action failed.')));
  });
});

describe('TenantActions — delete permanently', () => {
  it('opens the typed-confirmation dialog and passes onPurged through', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.purgeTenant).mockResolvedValue({ success: true });
    const onPurged = vi.fn();
    renderActions(makeTenant(), onPurged);

    await user.click(getDelete());
    const dialog = screen.getByRole('dialog', { name: /permanently delete acme stone co\./i });
    await user.type(within(dialog).getByRole('textbox'), 'acme');
    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(platformService.purgeTenant).toHaveBeenCalledWith('t-1', 'acme'));
    await waitFor(() => expect(onPurged).toHaveBeenCalledTimes(1));
  });
});
