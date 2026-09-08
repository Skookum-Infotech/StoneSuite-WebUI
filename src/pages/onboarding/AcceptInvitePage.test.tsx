import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
