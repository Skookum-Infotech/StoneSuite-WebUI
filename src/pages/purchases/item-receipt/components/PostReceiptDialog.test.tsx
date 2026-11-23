import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/itemReceiptService', () => ({ itemReceiptService: { post: vi.fn() } }));

import { PostReceiptDialog } from './PostReceiptDialog';
import { itemReceiptService } from '@/services/itemReceiptService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { OVER_RECEIPT_MESSAGE } from '@/lib/itemReceiptErrors';
import type { ItemReceipt } from '@/types/itemReceipt';

// Posting an existing Pending receipt: only receipts created before save-and-post
// (or through the API) can still be Pending, but the dialog must keep working.

function overReceiptError(): AxiosError {
  const message = `item receipt: ${OVER_RECEIPT_MESSAGE}: line 2 (ordered 10, already received 4, receiving 20)`;
  return new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 403, data: { success: false, message },
  } as AxiosResponse);
}

function renderDialog({ canApprove = false } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => resource === 'item_receipt' && action === 'approve' ? canApprove : true,
  } as ReturnType<typeof useUserPermissions>);
  const onPosted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PostReceiptDialog itemReceiptId="ir-1" onPosted={onPosted} />
    </QueryClientProvider>,
  );
  return { onPosted };
}

const posted = { id: 'ir-1', statusCode: 'RCVD' } as unknown as ItemReceipt;

beforeEach(() => vi.clearAllMocks());

describe('PostReceiptDialog', () => {
  it('posts a pending receipt after one confirmation', async () => {
    vi.mocked(itemReceiptService.post).mockResolvedValue(posted);
    const { onPosted } = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Post Receipt' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Post this item receipt?');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post Receipt' }));

    await waitFor(() => expect(itemReceiptService.post).toHaveBeenCalledWith('ir-1', {}));
    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(posted));
  });

  it('lets an approver accept an over-delivery with a reason', async () => {
    vi.mocked(itemReceiptService.post).mockRejectedValueOnce(overReceiptError()).mockResolvedValueOnce(posted);
    const { onPosted } = renderDialog({ canApprove: true });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Post Receipt' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post Receipt' }));

    const dialog = await screen.findByRole('dialog', { name: 'This exceeds the ordered quantity' });
    expect(dialog).toHaveTextContent('Line 2 — ordered 10, already received 4, receiving 20');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm & Post' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Over-receipt reason' }), 'pallet');
    await user.click(confirm);

    await waitFor(() => expect(itemReceiptService.post).toHaveBeenLastCalledWith('ir-1', { overReceiptReason: 'pallet' }));
    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(posted));
  });

  it('tells someone without the approve grant to escalate', async () => {
    vi.mocked(itemReceiptService.post).mockRejectedValue(overReceiptError());
    renderDialog({ canApprove: false });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Post Receipt' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post Receipt' }));

    const dialog = await screen.findByRole('dialog', { name: 'This exceeds the ordered quantity' });
    expect(dialog).toHaveTextContent("You don't have permission to accept an over-delivery.");
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
