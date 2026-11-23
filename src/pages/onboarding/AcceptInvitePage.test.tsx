import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  userService: { getUserInvite: vi.fn(), acceptUserInvite: vi.fn() },
}));
vi.mock('@/services/authService', () => ({
  authService: { getPortalInvite: vi.fn(), acceptPortalInvite: vi.fn() },
}));
vi.mock('@/api/tenantClient', () => ({
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

import AcceptInvitePage from './AcceptInvitePage';
import { userService } from '@/services/tenantServices';
import { authService } from '@/services/authService';

function lookupError(data: Record<string, unknown>) {
  return { response: { data } };
}

function renderPage(token = 'tok-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/accept-invite?token=${token}`]}>
        <AcceptInvitePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AcceptInvitePage', () => {
  it('shows the "expired" card for a terminal STAFF invite and never probes the portal', async () => {
    vi.mocked(userService.getUserInvite).mockRejectedValue(
      lookupError({ success: false, status: 'expired', message: 'This invitation has expired.' }),
    );
    renderPage();

    expect(await screen.findByText(/invitation expired/i)).toBeInTheDocument();
    expect(authService.getPortalInvite).not.toHaveBeenCalled();
  });

  it('shows the "already accepted" card with a sign-in link for an accepted staff invite', async () => {
    vi.mocked(userService.getUserInvite).mockRejectedValue(
      lookupError({ success: false, status: 'accepted' }),
    );
    renderPage();

    expect(await screen.findByText(/already accepted/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('falls back to the portal lookup for a token that is not a staff invite', async () => {
    vi.mocked(userService.getUserInvite).mockRejectedValue(
      lookupError({ success: false, message: 'Invite not found.' }),
    );
    vi.mocked(authService.getPortalInvite).mockResolvedValue({
      email: 'buyer@acme.com',
      fullName: 'Casey Buyer',
      workspaceName: 'Acme Stone Co',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    renderPage();

    expect(await screen.findByText(/set your password/i)).toBeInTheDocument();
    expect(authService.getPortalInvite).toHaveBeenCalledTimes(1);
  });
});

const STRONG = 'Abcdef1!';

// Portal path: no full-name field, so these tests exercise only the password fields.
function mockPortalInvite() {
  vi.mocked(userService.getUserInvite).mockRejectedValue(
    lookupError({ success: false, message: 'Invite not found.' }),
  );
  vi.mocked(authService.getPortalInvite).mockResolvedValue({
    email: 'buyer@acme.com',
    fullName: 'Casey Buyer',
    workspaceName: 'Acme Stone Co',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  vi.mocked(authService.acceptPortalInvite).mockResolvedValue({ success: true });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
  await user.type(await screen.findByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Activate account' }));
}

describe('AcceptInvitePage password validation', () => {
  it('rejects a password with no special character and does not call the API', async () => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    await fillAndSubmit(user, 'Abcdefg1', 'Abcdefg1');

    expect(await screen.findByText('Must include a special character')).toBeInTheDocument();
    expect(authService.acceptPortalInvite).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'too short', password: 'Ab1!', message: 'Must be at least 8 characters' },
    { name: 'no uppercase', password: 'abcdefg1!', message: 'Must include an uppercase letter' },
    { name: 'no lowercase', password: 'ABCDEFG1!', message: 'Must include a lowercase letter' },
    { name: 'no number', password: 'Abcdefgh!', message: 'Must include a number' },
  ])('rejects a password that is $name', async ({ password, message }) => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    await fillAndSubmit(user, password, password);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(authService.acceptPortalInvite).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    await fillAndSubmit(user, STRONG, 'Abcdef1?');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(authService.acceptPortalInvite).not.toHaveBeenCalled();
  });

  it('activates a portal invite with a strong, matching password', async () => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    await fillAndSubmit(user, STRONG, STRONG);

    expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
    expect(authService.acceptPortalInvite).toHaveBeenCalledWith('tok-1', STRONG);
  });

  it('holds a staff invite to the same policy', async () => {
    vi.mocked(userService.getUserInvite).mockResolvedValue({
      success: true,
      email: 'new.hire@acme.com',
      fullName: 'Jane Smith',
      workspaceName: 'Acme Stone Co',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Full name'), ' Jr');
    await fillAndSubmit(user, 'Abcdefg1', 'Abcdefg1');

    expect(await screen.findByText('Must include a special character')).toBeInTheDocument();
    expect(userService.acceptUserInvite).not.toHaveBeenCalled();
  });

  it('shows the live requirements checklist', async () => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Password'), 'abc');

    expect(screen.getByText('One lowercase letter').closest('li')).toHaveTextContent('(met)');
    expect(screen.getByText('One uppercase letter').closest('li')).toHaveTextContent('(not met)');
  });
});

describe('AcceptInvitePage show/hide password', () => {
  it('reveals and re-masks each password field independently', async () => {
    mockPortalInvite();
    const user = userEvent.setup();
    renderPage();
    const password = await screen.findByLabelText('Password');
    const confirm = screen.getByLabelText('Confirm password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show confirmation password' }));
    expect(confirm).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
