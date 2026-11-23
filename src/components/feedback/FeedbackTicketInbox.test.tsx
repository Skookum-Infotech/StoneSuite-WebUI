import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('@/services/feedbackService', () => ({
  feedbackService: {
    listMine: vi.fn(),
    markSeen: vi.fn(),
    getMine: vi.fn(),
    addComment: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));

import { FeedbackTicketInbox } from './FeedbackTicketInbox';
import { feedbackService } from '@/services/feedbackService';
import type { FeedbackTicket } from '@/types/feedback';

const BASE: FeedbackTicket = {
  id: 'ticket-13',
  ticketSeq: 13,
  ticketNumber: 'FB-13',
  tenantId: 'tenant-1',
  reporterKind: 'staff',
  reporterEmail: 'reporter@example.com',
  reporterName: 'Reporter',
  category: 'bug',
  description: 'Totals look wrong',
  status: 'new',
  priority: 'normal',
  reporterLastSeenAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-21T10:00:00Z',
  updatedAt: '2026-09-21T10:00:00Z',
};
const NEWEST = BASE;
const OLDER: FeedbackTicket = {
  ...BASE,
  id: 'ticket-12',
  ticketSeq: 12,
  ticketNumber: 'FB-12',
  category: 'feature_request',
  description: 'Add export to CSV',
  status: 'in_progress',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
};
const OLDEST: FeedbackTicket = { ...BASE, id: 'ticket-11', ticketSeq: 11, ticketNumber: 'FB-11', description: 'Slow search' };
const ALL = [NEWEST, OLDER, OLDEST];

const SPLIT_VIEW_QUERY = '(min-width: 80rem)';

/** Stands in for the viewport: the split (two-pane) layout needs xl+. */
function setViewport(width: 'wide' | 'narrow') {
  window.matchMedia = vi.fn((query: string) => ({
    matches: width === 'wide' && query === SPLIT_VIEW_QUERY,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/** Test-only probe so assertions can read the URL the inbox writes. */
function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

function renderInbox(url = '/support?tab=tickets', onCreateTicket: () => void = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <FeedbackTicketInbox onCreateTicket={onCreateTicket} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Lets pending microtasks run so a "never called" assertion cannot pass
 *  merely because the call would have happened a tick later. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const rowNames = () => screen.getAllByRole('button', { name: /^Open ticket/ }).map((b) => b.getAttribute('aria-label'));

let originalMatchMedia: typeof window.matchMedia;
beforeEach(() => {
  vi.clearAllMocks();
  originalMatchMedia = window.matchMedia;
  setViewport('narrow');
  vi.mocked(feedbackService.listMine).mockResolvedValue({ tickets: ALL, nextCursor: '' });
  vi.mocked(feedbackService.markSeen).mockResolvedValue(undefined);
  vi.mocked(feedbackService.getMine).mockImplementation(async (id: string) => ({
    ticket: ALL.find((t) => t.id === id) ?? NEWEST,
    comments: [],
    attachments: [],
  }));
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('FeedbackTicketInbox list', () => {
  it('lists the reporter\'s tickets in the order the server returned them', async () => {
    renderInbox();

    await screen.findByRole('button', { name: /^Open ticket FB-13/ });
    expect(rowNames()).toEqual([
      'Open ticket FB-13, New',
      'Open ticket FB-12, In Progress',
      'Open ticket FB-11, New',
    ]);
  });

  it('shows a loading placeholder while the first page is on its way', () => {
    vi.mocked(feedbackService.listMine).mockReturnValue(new Promise(() => {}));

    renderInbox();

    expect(screen.getByRole('status', { name: 'Loading tickets' })).toBeInTheDocument();
  });

  // The server's cursor is opaque; the UI only ever hands back what it was given.
  it('loads the next page with the cursor the server returned', async () => {
    vi.mocked(feedbackService.listMine)
      .mockResolvedValueOnce({ tickets: [NEWEST, OLDER], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ tickets: [OLDEST], nextCursor: '' });
    const user = userEvent.setup();
    renderInbox();

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('button', { name: /^Open ticket FB-11/ })).toBeInTheDocument();
    expect(feedbackService.listMine).toHaveBeenNthCalledWith(1, '');
    expect(feedbackService.listMine).toHaveBeenNthCalledWith(2, 'cursor-2');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('marks the reporter\'s tickets seen once, when the inbox opens', async () => {
    renderInbox();

    await waitFor(() => expect(feedbackService.markSeen).toHaveBeenCalledTimes(1));
  });
});

describe('FeedbackTicketInbox when there is nothing to show', () => {
  it('invites the reporter to file their first ticket', async () => {
    vi.mocked(feedbackService.listMine).mockResolvedValue({ tickets: [], nextCursor: '' });
    const onCreateTicket = vi.fn();
    const user = userEvent.setup();
    renderInbox('/support?tab=tickets', onCreateTicket);

    await user.click(await screen.findByRole('button', { name: 'Create your first ticket' }));

    expect(onCreateTicket).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load and lets the reporter try again', async () => {
    vi.mocked(feedbackService.listMine)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ tickets: ALL, nextCursor: '' });
    const user = userEvent.setup();
    renderInbox();

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: /^Open ticket FB-13/ })).toBeInTheDocument();
  });
});

describe('FeedbackTicketInbox on a narrow screen', () => {
  // One pane at a time: opening nothing until the reporter chooses.
  it('shows only the list until a ticket is chosen', async () => {
    renderInbox();
    await screen.findByRole('button', { name: /^Open ticket FB-13/ });
    await settle();

    expect(feedbackService.getMine).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'FB-13' })).not.toBeInTheDocument();
  });

  it('opens the chosen ticket, replacing the list, and records it in the URL', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(await screen.findByRole('button', { name: /^Open ticket FB-12/ }));

    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Open ticket/ })).not.toBeInTheDocument();
    // The tab stays; only the ticket is added.
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=tickets&ticket=ticket-12');
  });

  it('goes back to the list, clearing the ticket from the URL', async () => {
    const user = userEvent.setup();
    renderInbox();
    await user.click(await screen.findByRole('button', { name: /^Open ticket FB-12/ }));

    await user.click(await screen.findByRole('button', { name: 'Back to tickets' }));

    expect(await screen.findByRole('button', { name: /^Open ticket FB-13/ })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent(/^\?tab=tickets$/);
  });

  it('opens a ticket straight from a link', async () => {
    renderInbox('/support?tab=tickets&ticket=ticket-12');

    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
    expect(feedbackService.getMine).toHaveBeenCalledWith('ticket-12');
  });
});

describe('FeedbackTicketInbox on a wide screen', () => {
  beforeEach(() => setViewport('wide'));

  // The right-hand pane should never sit empty while tickets exist.
  it('opens the newest ticket beside the list without being asked', async () => {
    renderInbox();

    expect(await screen.findByRole('heading', { name: 'FB-13' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open ticket FB-13, New' })).toHaveAttribute('aria-current', 'true');
    // The list stays visible next to it, and the URL is left alone.
    expect(screen.getByRole('button', { name: 'Open ticket FB-12, In Progress' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent(/^\?tab=tickets$/);
  });

  it('switches the conversation when another ticket is picked', async () => {
    const user = userEvent.setup();
    renderInbox();
    await screen.findByRole('heading', { name: 'FB-13' });

    await user.click(screen.getByRole('button', { name: /^Open ticket FB-12/ }));

    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Open ticket FB-12/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent('ticket=ticket-12');
  });

  // The reply box lives inside the detail pane; without a fresh pane per
  // ticket, words meant for one ticket would show up in another. Both tickets
  // are visited once first so their conversations are cached: an uncached one
  // shows a loading placeholder that would clear the box by accident.
  it('does not carry a half-written reply over to another ticket', async () => {
    const user = userEvent.setup();
    renderInbox();
    await screen.findByRole('heading', { name: 'FB-13' });
    await user.click(screen.getByRole('button', { name: /^Open ticket FB-12/ }));
    await screen.findByRole('heading', { name: 'FB-12' });
    await user.click(screen.getByRole('button', { name: /^Open ticket FB-13/ }));
    await screen.findByRole('heading', { name: 'FB-13' });
    await user.type(screen.getByRole('textbox', { name: 'Reply to this ticket' }), 'Draft for the first ticket');

    await user.click(screen.getByRole('button', { name: /^Open ticket FB-12/ }));

    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Reply to this ticket' })).toHaveValue('');
  });
});
