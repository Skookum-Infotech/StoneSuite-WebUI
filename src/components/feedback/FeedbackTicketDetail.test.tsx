import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/feedbackService', () => ({
  feedbackService: { getMine: vi.fn(), addComment: vi.fn(), downloadAttachment: vi.fn() },
}));

import { FeedbackTicketDetail } from './FeedbackTicketDetail';
import { feedbackService } from '@/services/feedbackService';
import type { FeedbackAttachment, FeedbackComment, FeedbackTicket, FeedbackTicketDetail as Detail } from '@/types/feedback';

const TICKET: FeedbackTicket = {
  id: 'ticket-1',
  ticketSeq: 12,
  ticketNumber: 'FB-12',
  tenantId: 'tenant-1',
  reporterKind: 'staff',
  reporterEmail: 'reporter@example.com',
  reporterName: 'Reporter',
  category: 'bug',
  area: 'sales',
  rating: 4,
  description: 'Totals look wrong on the invoice.\nThe tax line is missing.',
  pageUrl: '/sales/invoice/9',
  status: 'in_progress',
  priority: 'normal',
  reporterLastSeenAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-21T09:12:00Z',
};

const SUPPORT_REPLY: FeedbackComment = {
  id: 'c1',
  feedbackId: 'ticket-1',
  authorKind: 'platform_admin',
  authorName: 'Priya (Support)',
  body: 'Thanks, we are looking into it.',
  isInternal: false,
  eventType: 'comment',
  createdAt: '2026-09-21T09:00:00Z',
};

const OWN_REPLY: FeedbackComment = {
  id: 'c2',
  feedbackId: 'ticket-1',
  authorKind: 'staff',
  authorName: 'Reporter',
  body: 'Any update on this?',
  isInternal: false,
  eventType: 'comment',
  createdAt: '2026-09-21T09:05:00Z',
};

const STATUS_CHANGE: FeedbackComment = {
  id: 'c3',
  feedbackId: 'ticket-1',
  authorKind: 'platform_admin',
  authorName: 'Priya (Support)',
  isInternal: false,
  eventType: 'status_change',
  oldStatus: 'new',
  newStatus: 'in_progress',
  createdAt: '2026-09-21T08:55:00Z',
};

const SCREENSHOT: FeedbackAttachment = {
  id: 'a1',
  feedbackId: 'ticket-1',
  fileName: 'invoice.png',
  contentType: 'image/png',
  sizeBytes: 2048,
  storageKey: 'feedback/ticket-1/invoice.png',
  createdAt: '2026-09-20T10:00:00Z',
};

function detail(overrides: Partial<Detail> = {}): Detail {
  return { ticket: TICKET, comments: [], attachments: [], ...overrides };
}

function renderDetail(props: { onBack?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<FeedbackTicketDetail ticketId="ticket-1" {...props} />, { wrapper });
}

/** Lets pending microtasks run so a "never called" assertion cannot pass
 *  merely because the call would have happened a tick later. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(feedbackService.getMine).mockResolvedValue(detail());
});

afterEach(() => vi.restoreAllMocks());

describe('FeedbackTicketDetail report', () => {
  it('shows the ticket the reporter filed', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByLabelText('Rated 4 out of 5')).toBeInTheDocument();
    expect(screen.getByText(/Totals look wrong on the invoice/)).toBeInTheDocument();
    expect(screen.getByText('/sales/invoice/9')).toBeInTheDocument();
  });

  it('shows a loading indicator until the ticket arrives', () => {
    vi.mocked(feedbackService.getMine).mockReturnValue(new Promise(() => {}));

    renderDetail();

    expect(screen.getByRole('status', { name: 'Loading ticket' })).toBeInTheDocument();
  });

  // A 404 can mean "exists but is not yours" (the IDOR guard), so the copy must
  // not repeat whatever the server said about it.
  it('says only that the ticket could not be loaded, without echoing the server\'s reason', async () => {
    vi.mocked(feedbackService.getMine).mockRejectedValue(new Error('ticket belongs to another tenant'));

    renderDetail();

    expect(await screen.findByText(/couldn.t load this ticket/i)).toBeInTheDocument();
    expect(screen.queryByText(/another tenant/i)).not.toBeInTheDocument();
  });
});

describe('FeedbackTicketDetail back button', () => {
  it('has no back button unless the parent wants one', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'FB-12' });

    expect(screen.queryByRole('button', { name: 'Back to tickets' })).not.toBeInTheDocument();
  });

  it('goes back to the list when asked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderDetail({ onBack });

    await user.click(await screen.findByRole('button', { name: 'Back to tickets' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // Otherwise a single-pane (mobile) reporter opening an unavailable ticket has no way out.
  it('still offers the way back when the ticket could not be loaded', async () => {
    vi.mocked(feedbackService.getMine).mockRejectedValue(new Error('nope'));

    renderDetail({ onBack: vi.fn() });

    expect(await screen.findByRole('button', { name: 'Back to tickets' })).toBeInTheDocument();
  });
});

describe('FeedbackTicketDetail conversation', () => {
  it('attributes each entry to the right party and shows status changes', async () => {
    vi.mocked(feedbackService.getMine).mockResolvedValue(
      detail({ comments: [STATUS_CHANGE, SUPPORT_REPLY, OWN_REPLY] }),
    );

    renderDetail();

    const conversation = await screen.findByRole('region', { name: 'Conversation' });
    expect(conversation).toHaveTextContent('Thanks, we are looking into it.');
    expect(conversation).toHaveTextContent('Any update on this?');
    expect(screen.getByText(/moved this to/)).toBeInTheDocument();
    // Support's reply carries the agent's name; the reporter's own is "You".
    expect(screen.getByText(/^Priya \(Support\) ·/)).toBeInTheDocument();
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
  });

  it('explains an empty conversation instead of leaving a blank area', async () => {
    renderDetail();

    expect(await screen.findByText(/No replies yet/)).toBeInTheDocument();
  });
});

describe('FeedbackTicketDetail attachments', () => {
  beforeEach(() => {
    vi.mocked(feedbackService.getMine).mockResolvedValue(detail({ attachments: [SCREENSHOT] }));
  });

  it('downloads the attachment that was clicked', async () => {
    const hrefs: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      hrefs.push(this.href);
    });
    vi.mocked(feedbackService.downloadAttachment).mockResolvedValue({
      downloadUrl: 'https://files.example.com/invoice.png',
      fileName: 'invoice.png',
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Download invoice.png' }));

    await waitFor(() => expect(hrefs).toEqual(['https://files.example.com/invoice.png']));
    expect(feedbackService.downloadAttachment).toHaveBeenCalledWith('ticket-1', 'a1');
  });

  it('tells the reporter when a download fails', async () => {
    vi.mocked(feedbackService.downloadAttachment).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Download invoice.png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invoice\.png/);
  });
});

describe('FeedbackTicketDetail reply', () => {
  const replyBox = () => screen.getByRole('textbox', { name: 'Reply to this ticket' });

  it('sends the trimmed reply, clears the box and shows the new message', async () => {
    vi.mocked(feedbackService.addComment).mockResolvedValue(OWN_REPLY);
    vi.mocked(feedbackService.getMine)
      .mockResolvedValueOnce(detail())
      .mockResolvedValue(detail({ comments: [OWN_REPLY] }));
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole('heading', { name: 'FB-12' });

    await user.type(replyBox(), '  Any update on this?  ');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    await waitFor(() => expect(feedbackService.addComment).toHaveBeenCalledWith('ticket-1', 'Any update on this?'));
    expect(await screen.findByRole('region', { name: 'Conversation' })).toHaveTextContent('Any update on this?');
    expect(replyBox()).toHaveValue('');
  });

  it('rejects an empty reply without calling the API', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole('heading', { name: 'FB-12' });

    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByText('Reply cannot be empty.')).toBeInTheDocument();
    await settle();
    expect(feedbackService.addComment).not.toHaveBeenCalled();
  });

  it('sends with Ctrl+Enter', async () => {
    vi.mocked(feedbackService.addComment).mockResolvedValue(OWN_REPLY);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole('heading', { name: 'FB-12' });

    await user.type(replyBox(), 'Any update on this?');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(feedbackService.addComment).toHaveBeenCalledWith('ticket-1', 'Any update on this?'));
  });

  // Losing a long reply to a network blip would be worse than the failure itself.
  it('keeps what was typed and says so when sending fails', async () => {
    vi.mocked(feedbackService.addComment).mockRejectedValue(new Error('Reply service unavailable'));
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole('heading', { name: 'FB-12' });

    await user.type(replyBox(), 'Any update on this?');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByText('Reply service unavailable')).toBeInTheDocument();
    expect(replyBox()).toHaveValue('Any update on this?');
  });
});
