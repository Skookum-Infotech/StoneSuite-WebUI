import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  userService: { inviteUser: vi.fn() },
  rbacService: { listRoles: vi.fn().mockResolvedValue([]) },
}));

import { InviteModal } from './InviteModal';
import { userService } from '@/services/tenantServices';

function axiosError(status: number, data: unknown) {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    data,
  } as never);
}

function renderModal(props: Partial<React.ComponentProps<typeof InviteModal>> = {}) {
  const onClose = vi.fn();
  const onViewInvites = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InviteModal onClose={onClose} onViewInvites={onViewInvites} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, onViewInvites };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('InviteModal', () => {
  it('closes on a successful send (emailSent: true)', async () => {
    vi.mocked(userService.inviteUser).mockResolvedValue({
      success: true,
      message: 'Invitation sent.',
      inviteId: 'inv-1',
      inviteLink: 'https://app.example/accept-invite?token=abc',
      emailSent: true,
    });
    const { onClose } = renderModal();

    await userEvent.type(screen.getByLabelText(/email address/i), 'new@colleague.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/could not be sent/i)).not.toBeInTheDocument();
  });

  it('shows the invite link with a copy button when the email fails (emailSent: false)', async () => {
    const link = 'https://app.example/accept-invite?token=xyz';
    vi.mocked(userService.inviteUser).mockResolvedValue({
      success: true,
      message: 'Invitation sent.',
      inviteId: 'inv-2',
      inviteLink: link,
      emailSent: false,
    });
    const { onClose } = renderModal();

    await userEvent.type(screen.getByLabelText(/email address/i), 'new@colleague.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText(link)).toBeInTheDocument();
    expect(screen.getByText(/email could not be sent/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /copy invite link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(link);

    await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a 409 conflict as an informational note and keeps the modal open', async () => {
    vi.mocked(userService.inviteUser).mockRejectedValue(
      axiosError(409, {
        message:
          'This email already has a pending invitation. Use Resend from the Invites list to send it again.',
      }),
    );
    const { onClose, onViewInvites } = renderModal();

    await userEvent.type(screen.getByLabelText(/email address/i), 'dupe@colleague.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText(/already has a pending invitation/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /view invitations/i }));
    expect(onViewInvites).toHaveBeenCalledTimes(1);
  });

  it('renders a non-conflict failure as an error', async () => {
    vi.mocked(userService.inviteUser).mockRejectedValue(
      axiosError(500, { message: 'Failed to create invitation.' }),
    );
    const { onClose } = renderModal();

    await userEvent.type(screen.getByLabelText(/email address/i), 'oops@colleague.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('Failed to create invitation.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view invitations/i })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
