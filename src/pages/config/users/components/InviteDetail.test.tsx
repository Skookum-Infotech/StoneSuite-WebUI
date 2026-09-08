import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  userService: { resendInvite: vi.fn(), revokeInvite: vi.fn() },
}));
vi.mock('@/api/tenantClient', () => ({
  apiErrorMessage: (_e: unknown, fallback?: string) => fallback ?? 'Something went wrong.',
}));

import { InviteDetail } from './InviteDetail';
import { userService } from '@/services/tenantServices';
import type { UserInvite } from '@/types/tenant';

const PENDING_INVITE: UserInvite = {
  ID: 'inv-1',
  TenantID: 't-1',
  Email: 'colleague@acme.com',
  FullName: 'Alex Colleague',
  InitialRoleID: '',
  Token: 'tok-1',
  Status: 'pending',
  InvitedBy: 'u-1',
  ExpiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
  AcceptedAt: null,
  CreatedAt: new Date().toISOString(),
};

function renderDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InviteDetail invite={PENDING_INVITE} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('InviteDetail resend', () => {
  it('confirms delivery when emailSent is true', async () => {
    vi.mocked(userService.resendInvite).mockResolvedValue({
      success: true,
      message: 'Invitation resent.',
      inviteLink: 'https://app.example/accept-invite?token=new',
      emailSent: true,
    });
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: /resend invitation/i }));

    expect(await screen.findByText(/email delivered/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy invite link/i })).not.toBeInTheDocument();
  });

  it('surfaces the fresh link with a copy button when emailSent is false', async () => {
    const link = 'https://app.example/accept-invite?token=fresh';
    vi.mocked(userService.resendInvite).mockResolvedValue({
      success: true,
      message: 'Invitation resent.',
      inviteLink: link,
      emailSent: false,
    });
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: /resend invitation/i }));

    expect(await screen.findByText(link)).toBeInTheDocument();
    expect(screen.getByText(/could not be sent/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link);
  });
});
