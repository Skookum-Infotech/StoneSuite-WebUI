import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentService', () => ({
  documentService: { sendToCustomer: vi.fn(), listSends: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { SendToCustomerDialog } from './SendToCustomerDialog';
import { documentSendsKey } from '@/lib/documentSends';
import { documentService } from '@/services/documentService';

const RECORD_ID = 'rec-1';
const EMAIL_ERROR =
  'The email could not be delivered. Please try again, or contact support if the problem continues.';

function renderDialog(open = true) {
  const onOpenChange = vi.fn();
  const onSent = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = (isOpen: boolean) => (
    <QueryClientProvider client={queryClient}>
      <SendToCustomerDialog
        recordId={RECORD_ID}
        open={isOpen}
        onOpenChange={onOpenChange}
        recipientEmail="buyer@acme.com"
        label="Invoice INV-1"
        onSent={onSent}
      />
    </QueryClientProvider>
  );
  const view = render(ui(open));
  return { ...view, onOpenChange, onSent, rerenderOpen: (isOpen: boolean) => view.rerender(ui(isOpen)) };
}

const confirm = () => screen.getByRole('button', { name: 'Confirm send to customer' });

beforeEach(() => {
  vi.clearAllMocks();
});

// The backend sends mail through stonesuite-notify and reports what really
// happened to it; the dialog must never say "Sent" when the email did not go.
describe('SendToCustomerDialog — email outcome', () => {
  it('confirms, closes and reports the send when the email was sent', async () => {
    const result = { sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: true };
    vi.mocked(documentService.sendToCustomer).mockResolvedValue(result);
    const { onOpenChange, onSent } = renderDialog();

    await userEvent.click(confirm());

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(result));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Sent to buyer@acme.com.');
  });

  it('treats a response without emailSent (older backend) as sent', async () => {
    const result = { sendId: 's1', sentTo: ['buyer@acme.com'] };
    vi.mocked(documentService.sendToCustomer).mockResolvedValue(result);
    const { onSent } = renderDialog();

    await userEvent.click(confirm());

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(result));
    expect(toast.success).toHaveBeenCalled();
  });

  it('stays open with the reason and never claims success when the email was not delivered', async () => {
    vi.mocked(documentService.sendToCustomer).mockResolvedValue({
      sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: false, emailError: EMAIL_ERROR,
    });
    const { onOpenChange, onSent } = renderDialog();

    await userEvent.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_ERROR);
    expect(onSent).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
    // Still there to retry.
    expect(confirm()).toBeEnabled();
  });

  it('falls back to a generic message when a failed send carries no reason', async () => {
    vi.mocked(documentService.sendToCustomer).mockResolvedValue({
      sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: false,
    });
    renderDialog();

    await userEvent.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent('The email could not be delivered.');
  });

  it('clears the failure and completes when a retry succeeds', async () => {
    const ok = { sendId: 's2', sentTo: ['buyer@acme.com'], emailSent: true };
    vi.mocked(documentService.sendToCustomer)
      .mockResolvedValueOnce({ sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: false, emailError: EMAIL_ERROR })
      .mockResolvedValueOnce(ok);
    const { onSent } = renderDialog();

    await userEvent.click(confirm());
    await screen.findByRole('alert');
    await userEvent.click(confirm());

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(ok));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show a stale delivery failure when the dialog is reopened', async () => {
    vi.mocked(documentService.sendToCustomer).mockResolvedValue({
      sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: false, emailError: EMAIL_ERROR,
    });
    const { rerenderOpen } = renderDialog();
    await userEvent.click(confirm());
    await screen.findByRole('alert');

    rerenderOpen(false);
    rerenderOpen(true);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still surfaces a request failure from the API', async () => {
    vi.mocked(documentService.sendToCustomer).mockRejectedValue(new Error('Failed to send email.'));
    const { onSent } = renderDialog();

    await userEvent.click(confirm());

    expect(await screen.findByText('Failed to send email.')).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });
});

function renderWithClientSpy() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <SendToCustomerDialog
        recordId={RECORD_ID}
        open
        onOpenChange={vi.fn()}
        recipientEmail="buyer@acme.com"
        label="Invoice INV-1"
        onSent={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return spy;
}

describe('SendToCustomerDialog — refreshes the email history', () => {
  it('refreshes the history after a send that went out', async () => {
    vi.mocked(documentService.sendToCustomer).mockResolvedValue({ sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: true });
    const spy = renderWithClientSpy();

    await userEvent.click(confirm());

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: documentSendsKey(RECORD_ID) }));
  });

  it('refreshes the history even when the email failed — the send is recorded either way', async () => {
    vi.mocked(documentService.sendToCustomer).mockResolvedValue({
      sendId: 's1', sentTo: ['buyer@acme.com'], emailSent: false, emailError: EMAIL_ERROR,
    });
    const spy = renderWithClientSpy();

    await userEvent.click(confirm());

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: documentSendsKey(RECORD_ID) }));
  });
});

// A document that already went out once (a purchase order resent to its vendor)
// is sent again through its own endpoint, and the copy must say "again".
describe('SendToCustomerDialog — resend mode', () => {
  function renderResend(send = vi.fn()) {
    const onOpenChange = vi.fn();
    const onSent = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SendToCustomerDialog
          recordId={RECORD_ID}
          open
          onOpenChange={onOpenChange}
          recipientEmail=""
          label="PO-1"
          recipientKind="vendor"
          resend
          send={send}
          onSent={onSent}
        />
      </QueryClientProvider>,
    );
    return { send, onOpenChange, onSent };
  }

  it('says it is sending again, not sending', () => {
    renderResend();
    expect(screen.getByRole('dialog', { name: 'Resend to vendor?' })).toBeInTheDocument();
    expect(screen.getByText('An email with this order will be sent again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm resend to vendor' })).toHaveTextContent('Resend to Vendor');
  });

  it('uses the supplied request, not the generic send, and reports "Resent"', async () => {
    const result = { sendId: 's9', sentTo: ['vendor@acme.com'], emailSent: true };
    const { send, onSent, onOpenChange } = renderResend(vi.fn().mockResolvedValue(result));

    await userEvent.click(screen.getByRole('button', { name: 'Confirm resend to vendor' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(result));
    expect(send).toHaveBeenCalledOnce();
    expect(documentService.sendToCustomer).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Resent to vendor@acme.com.');
  });

  it('stays open with the reason when the email did not go', async () => {
    const { onSent } = renderResend(
      vi.fn().mockResolvedValue({ sendId: 's9', sentTo: ['vendor@acme.com'], emailSent: false, emailError: EMAIL_ERROR }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm resend to vendor' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_ERROR);
    expect(onSent).not.toHaveBeenCalled();
  });
});
