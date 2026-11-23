import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  platformService: { inviteCustomer: vi.fn() },
}));

import { InviteCustomerModal } from './InviteCustomerModal';
import { platformService } from '@/services/tenantServices';

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InviteCustomerModal onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InviteCustomerModal', () => {
  it('blocks submit and shows an error when Recipient Name is blank', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText('Acme Corp'), 'Acme');
    await user.type(screen.getByPlaceholderText('jane@acme.com'), 'jane@acme.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText('Recipient name is required')).toBeInTheDocument();
    expect(platformService.inviteCustomer).not.toHaveBeenCalled();
  });

  it('submits when all required fields are filled', async () => {
    vi.mocked(platformService.inviteCustomer).mockResolvedValue({
      inviteLink: 'https://x/invite',
      emailSent: true,
    } as never);
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText('Acme Corp'), 'Acme');
    await user.type(screen.getByPlaceholderText('Jane Doe'), 'Jane');
    await user.type(screen.getByPlaceholderText('jane@acme.com'), 'jane@acme.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() =>
      expect(platformService.inviteCustomer).toHaveBeenCalledWith({
        companyName: 'Acme',
        recipientName: 'Jane',
        contactEmail: 'jane@acme.com',
      }),
    );
  });
});
