import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { RejectApprovalDialog } from './RejectApprovalDialog';

interface Updated { id: string }

function renderDialog(run = vi.fn<(reason: string) => Promise<Updated>>().mockResolvedValue({ id: 'po-1' }), warning?: string) {
  const onRejected = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RejectApprovalDialog noun="purchase order" run={run} onRejected={onRejected} warning={warning} />
    </QueryClientProvider>,
  );
  return { run, onRejected };
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Reject this purchase order' }));
  return user;
}

describe('RejectApprovalDialog', () => {
  it('opens a dialog naming the record and keeps Reject disabled until a reason is typed', async () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const user = await openDialog();

    expect(screen.getByRole('dialog', { name: 'Reject this purchase order?' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Reject purchase order' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), '   ');
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), 'Wrong vendor');
    expect(submit).toBeEnabled();
  });

  it('sends the trimmed reason, hands back the updated record and closes', async () => {
    const { run, onRejected } = renderDialog();
    const user = await openDialog();

    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), '  Wrong vendor  ');
    await user.click(screen.getByRole('button', { name: 'Reject purchase order' }));

    await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1));
    expect(run).toHaveBeenCalledWith('Wrong vendor');
    expect(onRejected.mock.calls[0][0]).toEqual({ id: 'po-1' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server error and stays open when rejecting fails', async () => {
    const err = new AxiosError('Forbidden');
    err.response = {
      status: 403, statusText: 'Forbidden', headers: {}, config: {} as never,
      data: { message: 'you are not a configured approver for this purchase order' },
    };
    const run = vi.fn<(reason: string) => Promise<Updated>>().mockRejectedValue(err);
    const { onRejected } = renderDialog(run);
    const user = await openDialog();

    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), 'Wrong vendor');
    await user.click(screen.getByRole('button', { name: 'Reject purchase order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a configured approver/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('closes on Cancel without rejecting anything', async () => {
    const { run } = renderDialog();
    const user = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('tells the approver what rejecting does when the caller supplies a warning', async () => {
    renderDialog(undefined, 'The order goes back to Draft.');
    await openDialog();

    expect(screen.getByText('The order goes back to Draft.')).toBeInTheDocument();
  });
});
