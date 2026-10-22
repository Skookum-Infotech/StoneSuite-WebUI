import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/recordEmailService', () => ({
  recordEmailService: { list: vi.fn(), reply: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { SalesOrderCommunicationTab } from './SalesOrderCommunicationTab';
import { recordEmailService } from '@/services/recordEmailService';
import { toast } from 'sonner';
import type { RecordEmailMessage, RecordEmailThread } from '@/types/recordEmail';

const ORDER_ID = 'so-1';
const CUSTOMER = 'priya@gmail.com';

function msg(over: Partial<RecordEmailMessage> = {}): RecordEmailMessage {
  return {
    id: 'm1', recordId: ORDER_ID, workflowKey: 'sales_order', direction: 'out',
    fromName: 'Harish Narne', fromEmail: 'harish@acme.com', to: CUSTOMER, cc: '',
    subject: 'Your Sales Order SO-1', body: 'Hello Priya, your order is ready.', attachmentCount: 0, internal: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), ...over,
  };
}

function thread(over: Partial<RecordEmailThread> = {}): RecordEmailThread {
  return { enabled: true, replyTo: CUSTOMER, messages: [msg()], ...over };
}

function renderTab(canReply = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SalesOrderCommunicationTab orderId={ORDER_ID} canReply={canReply} />
    </QueryClientProvider>,
  );
}

const replyBox = () => screen.getByRole('textbox');
const sendButton = () => screen.getByRole('button', { name: /^(Send reply|Save internal note)$/ });
const internalSwitch = () => screen.getByRole('switch', { name: 'Internal only' });

// Radix's Switch (Internal only) measures itself with a ResizeObserver, which
// jsdom does not provide.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recordEmailService.reply).mockResolvedValue({});
});

describe('SalesOrderCommunicationTab conversation', () => {
  it('tells staff how to start when there are no emails yet', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({ replyTo: '', messages: [] }));
    renderTab();

    expect(await screen.findByText('No emails yet')).toBeInTheDocument();
  });

  it('reads oldest first with the newest at the bottom, staff and customer told apart', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({
      messages: [
        msg({ id: 'm1', body: 'Hello Priya, your order is ready.' }),
        msg({
          id: 'm2', direction: 'in', fromName: 'Priya Shah', fromEmail: CUSTOMER, to: '',
          body: 'Can you install on Friday?', attachmentCount: 2,
          createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        }),
      ],
    }));
    renderTab();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Harish Narne');
    expect(items[0]).toHaveTextContent(`To ${CUSTOMER}`);
    expect(items[1]).toHaveTextContent('Priya Shah');
    expect(items[1]).toHaveTextContent('Can you install on Friday?');
    expect(items[1]).toHaveTextContent('5m ago');
    expect(items[1]).toHaveTextContent('This email had 2 attachments (not shown).');
    // Only the sent email carries a recipient line.
    expect(items[1]).not.toHaveTextContent('To ');
    expect(screen.getByText('2 emails')).toBeInTheDocument();
    expect(screen.queryByText(/newest first/)).toBeNull();
  });

  it('shows an internal note as a marked, recipient-less card and counts it apart from the emails', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({
      messages: [
        msg({ id: 'm1' }),
        msg({ id: 'm2', to: '', subject: '', body: 'Customer wants granite.', internal: true }),
      ],
    }));
    renderTab();

    const items = await screen.findAllByRole('listitem');
    expect(items[1]).toHaveTextContent('Internal note');
    expect(items[1]).toHaveTextContent('Customer wants granite.');
    expect(items[1]).not.toHaveTextContent('To ');
    expect(items[0]).not.toHaveTextContent('Internal note');
    expect(screen.getByText('1 email · 1 internal note')).toBeInTheDocument();
  });

  it('folds a long reply behind Show more', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({
      messages: [msg({ direction: 'in', fromName: 'Priya Shah', body: 'word '.repeat(200) })],
    }));
    renderTab();

    const more = await screen.findByRole('button', { name: 'Show more' });
    await userEvent.click(more);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('explains when customer replies are not being captured, and still shows the history', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({ enabled: false }));
    renderTab();

    expect(await screen.findByText(/Customer replies are not being captured yet/)).toBeInTheDocument();
    expect(screen.getByText(/your order is ready/)).toBeInTheDocument();
  });

  it('shows an error when the conversation cannot be loaded', async () => {
    vi.mocked(recordEmailService.list).mockRejectedValue(new Error('down'));
    renderTab();

    expect(await screen.findByText('Failed to load the conversation.')).toBeInTheDocument();
  });
});

describe('SalesOrderCommunicationTab reply box', () => {
  beforeEach(() => vi.mocked(recordEmailService.list).mockResolvedValue(thread()));

  it('is hidden from someone who cannot update the order', async () => {
    renderTab(false);

    expect(await screen.findByText(/your order is ready/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says who the reply goes to and cannot send an empty message', async () => {
    renderTab();

    expect(await screen.findByLabelText('Reply to the customer')).toBeInTheDocument();
    expect(screen.getByText(CUSTOMER, { selector: 'span' })).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    await userEvent.type(replyBox(), '   ');
    expect(sendButton()).toBeDisabled();
  });

  it('emails the message when the reply icon is clicked, then clears the box', async () => {
    renderTab();
    await screen.findByLabelText('Reply to the customer');

    await userEvent.type(replyBox(), '  See you Friday.  ');
    await userEvent.click(sendButton());

    expect(recordEmailService.reply).toHaveBeenCalledWith(ORDER_ID, { message: 'See you Friday.', internalOnly: false });
    await vi.waitFor(() => expect(replyBox()).toHaveValue(''));
    expect(toast.success).toHaveBeenCalledWith(`Reply sent to ${CUSTOMER}.`);
  });

  it('sends with Ctrl+Enter too', async () => {
    renderTab();
    await screen.findByLabelText('Reply to the customer');

    await userEvent.type(replyBox(), 'Quick one{Control>}{Enter}{/Control}');

    expect(recordEmailService.reply).toHaveBeenCalledWith(ORDER_ID, { message: 'Quick one', internalOnly: false });
  });

  it('with Internal only on, saves a note instead and says nothing is emailed', async () => {
    renderTab();
    await screen.findByLabelText('Reply to the customer');
    expect(internalSwitch()).not.toBeChecked();

    await userEvent.click(internalSwitch());

    expect(internalSwitch()).toBeChecked();
    expect(screen.getByText(/only your team sees this\. Nothing is emailed\./)).toBeInTheDocument();
    expect(screen.queryByText(/Replying to/)).toBeNull();

    await userEvent.type(screen.getByLabelText('Internal note'), 'Called Priya, she wants granite.');
    await userEvent.click(screen.getByRole('button', { name: 'Save internal note' }));

    expect(recordEmailService.reply).toHaveBeenCalledWith(ORDER_ID, {
      message: 'Called Priya, she wants granite.', internalOnly: true,
    });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Internal note saved.'));
    // The next message starts as an email to the customer again.
    await vi.waitFor(() => expect(internalSwitch()).not.toBeChecked());
    expect(screen.getByLabelText('Reply to the customer')).toHaveValue('');
  });

  it('locks to internal notes until an email has been sent to the customer', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({ replyTo: '', messages: [] }));
    renderTab();

    expect(await screen.findByLabelText('Internal note')).toBeInTheDocument();
    expect(internalSwitch()).toBeChecked();
    expect(internalSwitch()).toBeDisabled();
    expect(screen.getByText(/use Send to customer first/)).toBeInTheDocument();

    await userEvent.type(replyBox(), 'Waiting on the deposit.');
    await userEvent.click(sendButton());

    expect(recordEmailService.reply).toHaveBeenCalledWith(ORDER_ID, {
      message: 'Waiting on the deposit.', internalOnly: true,
    });
  });

  it('locks to internal notes when inbound email is not set up', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue(thread({ enabled: false }));
    renderTab();

    expect(await screen.findByLabelText('Internal note')).toBeInTheDocument();
    expect(internalSwitch()).toBeDisabled();
    expect(screen.getByText(/Email replies are not set up for this workspace yet/)).toBeInTheDocument();
  });

  it('keeps the text and shows the reason when the send fails', async () => {
    vi.mocked(recordEmailService.reply).mockRejectedValue(new Error('Failed to send the email.'));
    renderTab();
    await screen.findByLabelText('Reply to the customer');

    await userEvent.type(replyBox(), 'Important');
    await userEvent.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to send the email.');
    expect(replyBox()).toHaveValue('Important');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('says so when the reply was saved but the email was not delivered', async () => {
    vi.mocked(recordEmailService.reply).mockResolvedValue({ emailSent: false, emailError: 'The address was rejected.' });
    renderTab();
    await screen.findByLabelText('Reply to the customer');

    await userEvent.type(replyBox(), 'Hello');
    await userEvent.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('The reply was saved, but the email could not be delivered. The address was rejected.');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
