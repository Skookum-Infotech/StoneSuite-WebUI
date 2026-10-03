import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentService', () => ({
  documentService: { listSends: vi.fn() },
}));

import { DocumentSendHistory } from './DocumentSendHistory';
import { documentSendsKey } from '@/lib/documentSends';
import { documentService, type DocumentSendRecord } from '@/services/documentService';

function send(over: Partial<DocumentSendRecord> = {}): DocumentSendRecord {
  return {
    id: 's1', recordId: 'rec-1', workflowKey: 'invoice', sentTo: 'buyer@acme.com',
    sentAt: new Date(Date.now() - 5 * 60_000).toISOString(), ...over,
  };
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentSendHistory recordId="rec-1" />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => vi.clearAllMocks());

describe('DocumentSendHistory', () => {
  it('uses a stable query key other components can invalidate', () => {
    expect(documentSendsKey('rec-1')).toEqual(['document-sends', 'rec-1']);
  });

  it('says so when nothing has been emailed yet', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([]);
    renderCard();
    expect(await screen.findByText('Not emailed yet.')).toBeInTheDocument();
  });

  it('lists each send with its recipient, how long ago, and its real status', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([
      send({ id: 's1', sentTo: 'buyer@acme.com', emailStatus: 'delivered' }),
      send({
        id: 's2', sentTo: 'old@acme.com', cc: 'boss@acme.com', emailStatus: 'bounced',
        emailStatusMessage: "The recipient's mail server rejected this email. Check the address and try again.",
      }),
    ]);
    renderCard();

    expect(await screen.findByText('buyer@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Not delivered')).toBeInTheDocument();
    expect(screen.getByText(/old@acme\.com/)).toBeInTheDocument();
    // A problem is explained in words on the page, not only in a tooltip.
    expect(screen.getByText(/rejected this email/i)).toBeVisible();
    expect(screen.getAllByText(/5m ago/i).length).toBeGreaterThan(0);
  });

  it('says a just-sent email is awaiting delivery, and explains what that means', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([send({ emailStatus: 'sent' })]);
    renderCard();

    expect(await screen.findByText('Awaiting delivery')).toBeInTheDocument();
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(screen.getByText(/delivery isn.t confirmed yet/i)).toBeVisible();
  });

  it('keeps a delivered send to one line: no explanatory paragraph', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([send({ emailStatus: 'delivered' })]);
    renderCard();

    expect(await screen.findByText('Delivered')).toBeInTheDocument();
    expect(screen.queryByText(/mail server accepted/i)).not.toBeInTheDocument();
  });

  it('shows no badge for a send with no status (an older send, or notify unreachable)', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([send({ emailStatus: 'unknown' })]);
    renderCard();

    expect(await screen.findByText('buyer@acme.com')).toBeInTheDocument();
    expect(document.querySelector('[data-email-status]')).toBeNull();
  });

  it('shows the latest five and reveals the rest on request', async () => {
    const many = Array.from({ length: 7 }, (_, i) => send({ id: `s${i}`, sentTo: `r${i}@acme.com` }));
    vi.mocked(documentService.listSends).mockResolvedValue(many);
    renderCard();

    expect(await screen.findByText('r0@acme.com')).toBeInTheDocument();
    expect(screen.queryByText('r5@acme.com')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show 2 more/i }));

    expect(screen.getByText('r5@acme.com')).toBeInTheDocument();
    expect(screen.getByText('r6@acme.com')).toBeInTheDocument();
  });

  it('degrades to a quiet message, not a crash, when the history cannot be loaded', async () => {
    vi.mocked(documentService.listSends).mockRejectedValue(new Error('network'));
    renderCard();
    expect(await screen.findByText(/couldn.t load email history/i)).toBeInTheDocument();
  });

  it('refetches when Refresh is pressed', async () => {
    vi.mocked(documentService.listSends).mockResolvedValue([send()]);
    renderCard();
    await screen.findByText('buyer@acme.com');
    expect(documentService.listSends).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /refresh email history/i }));

    await waitFor(() => expect(documentService.listSends).toHaveBeenCalledTimes(2));
  });
});
