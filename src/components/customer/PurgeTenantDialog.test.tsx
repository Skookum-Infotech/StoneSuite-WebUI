import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';

vi.mock('@/services/tenantServices', () => ({
  platformService: { purgeTenant: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PurgeTenantDialog } from './PurgeTenantDialog';
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

function renderDialog(tenant: Tenant = makeTenant()) {
  const onClose = vi.fn();
  const onPurged = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <PurgeTenantDialog tenant={tenant} onClose={onClose} onPurged={onPurged} />
    </QueryClientProvider>,
  );
  return { onClose, onPurged, invalidate };
}

const confirmButton = () => screen.getByRole('button', { name: 'Delete permanently' });
const slugInput = () => screen.getByRole('textbox', { name: /type acme to confirm/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PurgeTenantDialog', () => {
  it('names the customer and exactly what will be destroyed', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: /permanently delete acme stone co\./i });
    expect(dialog).toHaveTextContent('tenant_acme');
    expect(dialog).toHaveTextContent('ss-acme');
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  it('omits the database and bucket lines for a customer that never got them', () => {
    renderDialog(makeTenant({ status: 'rejected', dbName: '', r2Bucket: '' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent('tenant_');
    expect(dialog).not.toHaveTextContent('ss-');
    expect(dialog).toHaveTextContent(/application/i);
  });

  it('keeps Delete permanently disabled until the slug is typed exactly', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(confirmButton()).toBeDisabled();

    await user.type(slugInput(), 'Acme');
    expect(confirmButton()).toBeDisabled();

    await user.clear(slugInput());
    await user.type(slugInput(), 'acme');
    expect(confirmButton()).toBeEnabled();
  });

  it('sends the slug to the backend, then reports success', async () => {
    const user = userEvent.setup();
    vi.mocked(platformService.purgeTenant).mockResolvedValue({ success: true });
    const { onPurged, invalidate } = renderDialog();

    await user.type(slugInput(), 'acme');
    await user.click(confirmButton());

    await waitFor(() => expect(onPurged).toHaveBeenCalledTimes(1));
    expect(platformService.purgeTenant).toHaveBeenCalledWith('t-1', 'acme');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenants'] });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Acme Stone Co.'));
  });

  it('shows the server message and stays open when the purge fails', async () => {
    const user = userEvent.setup();
    const err = new AxiosError('boom');
    err.response = {
      status: 500,
      data: { message: 'Permanent deletion stopped at the storage step. Run it again to resume.' },
      statusText: '',
      headers: {},
      config: {},
    } as never;
    vi.mocked(platformService.purgeTenant).mockRejectedValue(err);
    const { onPurged } = renderDialog();

    await user.type(slugInput(), 'acme');
    await user.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('stopped at the storage step');
    expect(onPurged).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('closes from Cancel and from Escape without deleting anything', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(platformService.purgeTenant).not.toHaveBeenCalled();
  });
});
