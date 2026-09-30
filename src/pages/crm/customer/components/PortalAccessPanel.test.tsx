import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/portalAccessService', () => ({
  portalAccessService: {
    listForCustomer: vi.fn(),
    grant: vi.fn(),
    resendInvite: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    revoke: vi.fn(),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { PortalAccessPanel } from './PortalAccessPanel';
import { portalAccessService } from '@/services/portalAccessService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { PortalUser } from '@/types/portalUser';

const CUSTOMER_UUID = 'cust-uuid-1';
const CONTACT_EMAIL = 'buyer@acme.com';
const CONTACT_NAME = 'Jane Smith';

function makeUser(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: 'pu-1',
    email: CONTACT_EMAIL,
    fullName: CONTACT_NAME,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    inviteStatus: 'pending',
    ...overrides,
  };
}

function mockPermissions(allowed = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string) => (resource === 'portal_access' ? allowed : false),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPanel(props: Partial<ComponentProps<typeof PortalAccessPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PortalAccessPanel
        customerUuid={CUSTOMER_UUID}
        customerApproved
        contactEmail={CONTACT_EMAIL}
        contactName={CONTACT_NAME}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortalAccessPanel — one login per customer', () => {
  it('offers Grant access when the customer has no portal login', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText('No portal logins granted yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grant portal access' })).toBeEnabled();
  });

  it('hides Grant access once an active portal login exists', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'active' })]);

    renderPanel();

    expect(await screen.findByText(CONTACT_NAME)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant portal access' })).not.toBeInTheDocument();
  });

  it('hides Grant access while a login is only suspended', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'suspended' })]);

    renderPanel();

    expect(await screen.findByText(CONTACT_NAME)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant portal access' })).not.toBeInTheDocument();
  });

  it('offers Grant access again when the only prior login was revoked', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ status: 'revoked' })]);

    renderPanel();

    expect(await screen.findByRole('button', { name: 'Grant portal access' })).toBeEnabled();
  });
});

describe('PortalAccessPanel — grant uses the record contact email', () => {
  it('grants access to the customer record contact email without a free-text field', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);
    vi.mocked(portalAccessService.grant).mockResolvedValue({ portalUser: makeUser(), emailSent: true });

    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Grant portal access' }));

    const dialog = screen.getByRole('dialog', { name: 'Grant portal access' });
    expect(within(dialog).getByText(CONTACT_EMAIL)).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Grant access' }));

    await waitFor(() =>
      expect(portalAccessService.grant).toHaveBeenCalledWith(CUSTOMER_UUID, {
        email: CONTACT_EMAIL,
        fullName: CONTACT_NAME,
      }),
    );
  });

  it('surfaces the backend error message when the grant fails', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);
    vi.mocked(portalAccessService.grant).mockRejectedValue(
      new Error('That email already belongs to a workspace user and cannot be used for portal access.'),
    );

    renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Grant portal access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant portal access' });
    await user.click(within(dialog).getByRole('button', { name: 'Grant access' }));

    expect(
      await screen.findByText(
        'That email already belongs to a workspace user and cannot be used for portal access.',
      ),
    ).toBeInTheDocument();
  });
});

// The backend sends mail through stonesuite-notify and reports what really
// happened; the UI must never show a plain success when the email did not go.
describe('PortalAccessPanel — invitation email outcome', () => {
  const EMAIL_ERROR = 'The email could not be delivered. Please try again, or contact support if the problem continues.';

  async function grantFromDialog() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Grant portal access' }));
    const dialog = screen.getByRole('dialog', { name: 'Grant portal access' });
    await user.click(within(dialog).getByRole('button', { name: 'Grant access' }));
    return dialog;
  }

  it('warns with the reason when granting succeeds but the email was not sent', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);
    vi.mocked(portalAccessService.grant).mockResolvedValue({
      portalUser: makeUser(), emailSent: false, emailError: EMAIL_ERROR,
    });

    renderPanel();
    await grantFromDialog();

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        'Portal access was granted, but the invitation email was not sent.',
        expect.objectContaining({ description: expect.stringContaining(EMAIL_ERROR) }),
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    // Access itself was granted, so the dialog closes.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Grant portal access' })).not.toBeInTheDocument());
  });

  it('confirms delivery when the email was sent', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);
    vi.mocked(portalAccessService.grant).mockResolvedValue({ portalUser: makeUser(), emailSent: true });

    renderPanel();
    await grantFromDialog();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Portal access granted. Invitation email sent.'));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('says nothing about email when no invite was sent (customer already has a password)', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);
    vi.mocked(portalAccessService.grant).mockResolvedValue({ portalUser: makeUser({ inviteStatus: 'none' }) });

    renderPanel();
    await grantFromDialog();

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Grant portal access' })).not.toBeInTheDocument());
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows a persistent error when a resend re-issues the invite but the email fails', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ inviteStatus: 'pending' })]);
    vi.mocked(portalAccessService.resendInvite).mockResolvedValue({
      portalUser: makeUser(), emailSent: false, emailError: EMAIL_ERROR,
    });

    renderPanel();
    await user.click(await screen.findByRole('button', { name: `Resend invitation to ${CONTACT_EMAIL}` }));

    expect(
      await screen.findByText(`The invitation was re-issued, but the email was not sent. ${EMAIL_ERROR}`),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('clears the error and confirms when a resend succeeds', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([makeUser({ inviteStatus: 'pending' })]);
    vi.mocked(portalAccessService.resendInvite)
      .mockResolvedValueOnce({ portalUser: makeUser(), emailSent: false, emailError: EMAIL_ERROR })
      .mockResolvedValueOnce({ portalUser: makeUser(), emailSent: true });

    renderPanel();
    const resend = () => screen.findByRole('button', { name: `Resend invitation to ${CONTACT_EMAIL}` });
    await user.click(await resend());
    await screen.findByText(/the email was not sent/);

    await user.click(await resend());

    await waitFor(() => expect(screen.queryByText(/the email was not sent/)).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Invitation email sent.');
  });
});

describe('PortalAccessPanel — grant preconditions', () => {
  it('disables Grant access until the customer record is approved', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);

    renderPanel({ customerApproved: false });

    expect(await screen.findByRole('button', { name: 'Grant portal access' })).toBeDisabled();
  });

  it('disables Grant access when the customer record has no contact email', async () => {
    mockPermissions();
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);

    renderPanel({ contactEmail: '' });

    expect(await screen.findByRole('button', { name: 'Grant portal access' })).toBeDisabled();
  });

  it('does not render Grant access without the portal_access create permission', async () => {
    mockPermissions(false);
    vi.mocked(portalAccessService.listForCustomer).mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText('No portal logins granted yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant portal access' })).not.toBeInTheDocument();
  });
});
