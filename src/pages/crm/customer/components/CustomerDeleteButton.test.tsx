import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/portalAccessService', () => ({
  portalAccessService: { listForCustomer: vi.fn() },
}));
vi.mock('@/services/crmService', () => ({
  crmService: { deleteRecord: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { CustomerDeleteButton } from './CustomerDeleteButton';
import { portalAccessService } from '@/services/portalAccessService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { PortalUser } from '@/types/portalUser';

const RECORD_ID = 'cust-uuid-1';
const COMPANY = 'Acme Stone Co.';

function makeUser(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: 'pu-1',
    email: 'buyer@acme.com',
    fullName: 'Jane Buyer',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    inviteStatus: 'none',
    ...overrides,
  };
}

function mockPermissions(canReadPortalAccess = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string) =>
      resource === 'portal_access' ? canReadPortalAccess : false,
  } as ReturnType<typeof useUserPermissions>);
}

function renderButton(props: Partial<ComponentProps<typeof CustomerDeleteButton>> = {}) {
  const onManagePortal = props.onManagePortal ?? vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerDeleteButton
        recordId={RECORD_ID}
        company={COMPANY}
        onDeleted={vi.fn()}
        onManagePortal={onManagePortal}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onManagePortal };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: `Delete Customer — ${COMPANY}` }));
  return screen.getByRole('dialog');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CustomerDeleteButton — blocks deletion while a live portal login exists', () => {
  it('blocks when the customer has an active portal login', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'active' })]);

    renderButton();
    const dialog = await openDialog(user);

    expect(await screen.findByText('buyer@acme.com')).toBeInTheDocument();
    expect(screen.getByText(/Revoke portal access before deleting/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete record' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for deletion/)).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('Can’t delete this record yet');
  });

  it('blocks when the only portal login is suspended', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'suspended' })]);

    renderButton();
    await openDialog(user);

    expect(await screen.findByText('buyer@acme.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete record' })).not.toBeInTheDocument();
  });

  it('"Manage portal access" fires onManagePortal and closes the dialog', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'active' })]);

    const { onManagePortal } = renderButton();
    await openDialog(user);

    await user.click(await screen.findByRole('button', { name: /Manage portal access/ }));

    expect(onManagePortal).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CustomerDeleteButton — allows deletion when no live portal login', () => {
  it('allows deletion when the customer has no portal logins', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);

    renderButton();
    await openDialog(user);

    // Wait for the query to settle, then the normal delete form is shown.
    expect(await screen.findByLabelText(/Reason for deletion/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete record' })).toBeInTheDocument();
  });

  it('allows deletion when every prior portal login is revoked', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'revoked' })]);

    renderButton();
    await openDialog(user);

    expect(await screen.findByLabelText(/Reason for deletion/)).toBeInTheDocument();
  });

  it('does not check portal access — nor block — without the portal_access read permission', async () => {
    const user = userEvent.setup();
    mockPermissions(false);

    renderButton();
    await openDialog(user);

    expect(screen.getByLabelText(/Reason for deletion/)).toBeInTheDocument();
    expect(portalAccessService.listForCustomer).not.toHaveBeenCalled();
  });
});
