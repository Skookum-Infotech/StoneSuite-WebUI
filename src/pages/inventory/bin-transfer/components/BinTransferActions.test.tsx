import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';

vi.mock('@/services/binTransferService', () => ({
  binTransferService: { complete: vi.fn(), transition: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { binTransferService } from '@/services/binTransferService';
import { BinTransferActions } from './BinTransferActions';
import { makeTransfer } from './binTransferFixtures';
import type { BinTransfer } from '@/types/binTransfer';

const ALLOWED = { transition: true, approve: true };

function renderActions(transfer: BinTransfer, can = ALLOWED) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <BinTransferActions transfer={transfer} can={can} />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => vi.clearAllMocks());

describe('BinTransferActions', () => {
  it('offers Complete then Cancel on an ungated draft', () => {
    renderActions(makeTransfer({ nextStatusCodes: ['CANC', 'COMP'] }));

    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Complete', 'Cancel Transfer']);
  });

  it('offers Submit for Approval on a draft while an approver is configured', () => {
    renderActions(makeTransfer({ nextStatusCodes: ['CANC', 'PAPV'] }));

    expect(screen.getByRole('button', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
  });

  it('leaves Approve and Return to Draft to the approvers while a transfer is gated', () => {
    renderActions(makeTransfer({ statusCode: 'PAPV', nextStatusCodes: ['APPV', 'CANC', 'DRFT'], gated: true }));

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel Transfer']);
  });

  it('shows nothing to someone with no transition grant', () => {
    renderActions(makeTransfer(), { transition: false, approve: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('asks before completing — it moves real stone — and does nothing until confirmed', async () => {
    vi.mocked(binTransferService.complete).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderActions(makeTransfer({ slabCount: 3 }));

    await user.click(screen.getByRole('button', { name: 'Complete' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('3 slabs will be moved');
    expect(binTransferService.complete).not.toHaveBeenCalled();

    // Backing out leaves the stone where it is.
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(binTransferService.complete).not.toHaveBeenCalled();
  });

  it('completes through the dedicated call, not a transition, and refreshes the slabs and bins', async () => {
    vi.mocked(binTransferService.complete).mockResolvedValue({} as never);
    const user = userEvent.setup();
    const queryClient = renderActions(makeTransfer());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Complete' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(binTransferService.complete).toHaveBeenCalledWith('bt-12'));
    expect(binTransferService.transition).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
    expect(keys).toContain(JSON.stringify(['inventory-units']));
    expect(keys).toContain(JSON.stringify(['inventory-bins-tree']));
  });

  it('keeps the reason a cancel was given', async () => {
    vi.mocked(binTransferService.transition).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderActions(makeTransfer());

    await user.click(screen.getByRole('button', { name: 'Cancel Transfer' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Customer changed the order');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel Transfer' }));

    await waitFor(() =>
      expect(binTransferService.transition).toHaveBeenCalledWith('bt-12', 'CANC', 'Customer changed the order'));
  });

  it('shows the server\'s reason a completion was refused, naming the slab', async () => {
    const err = new AxiosError('Request failed');
    err.response = { data: { message: 'Slab SLB-000231: This unit is in transit.' } } as AxiosError['response'];
    vi.mocked(binTransferService.complete).mockRejectedValue(err);
    const user = userEvent.setup();
    renderActions(makeTransfer());

    await user.click(screen.getByRole('button', { name: 'Complete' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Slab SLB-000231: This unit is in transit.');
    expect(toast.success).not.toHaveBeenCalled();
  });
});

