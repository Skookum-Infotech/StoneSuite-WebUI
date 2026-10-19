import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/recordEmailService', () => ({
  recordEmailService: { list: vi.fn() },
}));

import { SalesOrderCommunicationTab } from './SalesOrderCommunicationTab';
import { recordEmailService } from '@/services/recordEmailService';
import type { RecordEmailMessage } from '@/types/recordEmail';

const ORDER_ID = 'so-1';

function msg(over: Partial<RecordEmailMessage> = {}): RecordEmailMessage {
  return {
    id: 'm1', recordId: ORDER_ID, workflowKey: 'sales_order', direction: 'out',
    fromName: 'Harish Narne', fromEmail: 'harish@acme.com', to: 'priya@gmail.com', cc: '',
    subject: 'Your Sales Order SO-1', body: 'Hello Priya, your order is ready.', attachmentCount: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), ...over,
  };
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SalesOrderCommunicationTab orderId={ORDER_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('SalesOrderCommunicationTab', () => {
  it('tells staff how to start when there are no emails yet', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue({ enabled: true, messages: [] });
    renderTab();

    expect(await screen.findByText('No emails yet')).toBeInTheDocument();
  });

  it('shows the conversation newest first, with staff and customer told apart', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue({
      enabled: true,
      messages: [
        msg({ id: 'm1', body: 'Hello Priya, your order is ready.' }),
        msg({
          id: 'm2', direction: 'in', fromName: 'Priya Shah', fromEmail: 'priya@gmail.com', to: '',
          body: 'Can you install on Friday?', attachmentCount: 2,
          createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        }),
      ],
    });
    renderTab();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Priya Shah');
    expect(items[0]).toHaveTextContent('Can you install on Friday?');
    expect(items[0]).toHaveTextContent('5m ago');
    expect(items[0]).toHaveTextContent('This email had 2 attachments (not shown).');
    expect(items[1]).toHaveTextContent('Harish Narne');
    expect(items[1]).toHaveTextContent('To priya@gmail.com');
    // Only the sent email carries a recipient line.
    expect(items[0]).not.toHaveTextContent('To ');
  });

  it('folds a long reply behind Show more', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue({
      enabled: true,
      messages: [msg({ direction: 'in', fromName: 'Priya Shah', body: 'word '.repeat(200) })],
    });
    renderTab();

    const more = await screen.findByRole('button', { name: 'Show more' });
    await userEvent.click(more);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no reply box: the tab only shows the conversation', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue({ enabled: true, messages: [msg()] });
    renderTab();

    expect(await screen.findByText(/your order is ready/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to the customer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send reply' })).toBeNull();
  });

  it('explains when customer replies are not being captured, and still shows the history', async () => {
    vi.mocked(recordEmailService.list).mockResolvedValue({ enabled: false, messages: [msg()] });
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
