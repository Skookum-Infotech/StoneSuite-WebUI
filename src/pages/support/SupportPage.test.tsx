import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/services/feedbackService', () => ({
  feedbackService: { listMine: vi.fn(), markSeen: vi.fn(), submit: vi.fn(), getMine: vi.fn() },
}));
vi.mock('@/services/attachmentService', () => ({ attachmentService: { uploadToR2: vi.fn() } }));

import SupportPage from './SupportPage';
import { feedbackService } from '@/services/feedbackService';
import type { FeedbackTicket } from '@/types/feedback';

const TICKET: FeedbackTicket = {
  id: 'ticket-1',
  ticketSeq: 12,
  ticketNumber: 'FB-12',
  tenantId: 'tenant-1',
  reporterKind: 'staff',
  reporterEmail: 'reporter@example.com',
  reporterName: 'Reporter',
  category: 'bug',
  description: 'Totals look wrong',
  status: 'new',
  priority: 'normal',
  reporterLastSeenAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
};

/** Test-only probe so assertions can read the URL the page writes. */
function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

function renderAt(url: string) {
  // A long staleTime mirrors production (2 min): without it every remount
  // refetches on its own and would hide a missing cache invalidation.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/support"
            element={
              <>
                <SupportPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(feedbackService.listMine).mockResolvedValue({ tickets: [TICKET], nextCursor: '' });
  vi.mocked(feedbackService.markSeen).mockResolvedValue(undefined);
  vi.mocked(feedbackService.submit).mockResolvedValue(TICKET);
  vi.mocked(feedbackService.getMine).mockResolvedValue({ ticket: TICKET, comments: [], attachments: [] });
});

async function fileATicket(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Your Feedback \/ Description/), 'Another problem');
  await user.click(screen.getByRole('button', { name: 'Submit ticket' }));
  await screen.findByRole('heading', { name: 'Ticket FB-12 submitted' });
}

describe('SupportPage tabs', () => {
  // The sidebar entry is called "My Tickets", so a bare /support must land there.
  it('opens on My Tickets by default and lists the reporter\'s tickets', async () => {
    renderAt('/support');

    expect(screen.getByRole('tab', { name: 'My Tickets' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'New Ticket' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'My Tickets' })).toBeInTheDocument();
    expect(await screen.findByText('Totals look wrong')).toBeInTheDocument();
  });

  it('opens on the tab named by ?tab=', () => {
    renderAt('/support?tab=new');

    expect(screen.getByRole('tab', { name: 'New Ticket' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Where did this happen?')).toBeInTheDocument();
  });

  it('falls back to My Tickets for an unrecognised ?tab=', () => {
    renderAt('/support?tab=bogus');

    expect(screen.getByRole('tab', { name: 'My Tickets' })).toHaveAttribute('aria-selected', 'true');
  });

  // role="tab" is only valid inside a labelled tablist.
  it('groups both tabs in a labelled tablist', () => {
    renderAt('/support');

    const tablist = screen.getByRole('tablist', { name: 'Support sections' });

    expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
  });

  // Deep links (the Help menu shortcut) and a page reload both rely on the
  // active tab being written to the URL, not held only in component state.
  it('records the chosen tab in the URL', async () => {
    const user = userEvent.setup();
    renderAt('/support');

    await user.click(screen.getByRole('tab', { name: 'New Ticket' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=new');
    expect(screen.getByLabelText('Where did this happen?')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'My Tickets' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=tickets');
  });

  // The open ticket belongs to the My Tickets tab; carrying it into New Ticket
  // would leave a stale ticket id behind in the URL.
  it('drops the open ticket from the URL when switching tabs', async () => {
    const user = userEvent.setup();
    renderAt('/support?tab=tickets&ticket=ticket-1');
    await screen.findByRole('heading', { name: 'FB-12' });

    await user.click(screen.getByRole('tab', { name: 'New Ticket' }));

    expect(screen.getByTestId('search')).toHaveTextContent(/^\?tab=new$/);
  });
});

describe('SupportPage unread replies', () => {
  // Opening the ticket list is what clears the unread badge, so the list must
  // not be mounted (and mark everything seen) while the reporter is looking
  // at the New Ticket form.
  it('marks tickets seen only once My Tickets is actually shown', async () => {
    const user = userEvent.setup();
    renderAt('/support?tab=new');

    // react-query calls a mutation's function a few microtasks after mutate(),
    // so let those run first — otherwise "not called yet" passes vacuously.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(feedbackService.markSeen).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'My Tickets' }));

    await waitFor(() => expect(feedbackService.markSeen).toHaveBeenCalledTimes(1));
  });
});

describe('SupportPage after filing a ticket', () => {
  // The reporter may already have opened My Tickets earlier in the session, and
  // a cached list would then leave the ticket they just filed missing from it.
  it('shows the new ticket the next time My Tickets is opened', async () => {
    const user = userEvent.setup();
    renderAt('/support');
    await screen.findByText('Totals look wrong');
    expect(feedbackService.listMine).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('tab', { name: 'New Ticket' }));
    await fileATicket(user);

    await user.click(screen.getByRole('tab', { name: 'My Tickets' }));

    await waitFor(() => expect(feedbackService.listMine).toHaveBeenCalledTimes(2));
  });

  it('opens the ticket that was just filed', async () => {
    const user = userEvent.setup();
    renderAt('/support?tab=new');
    await fileATicket(user);

    await user.click(screen.getByRole('button', { name: 'View ticket' }));

    expect(screen.getByRole('tab', { name: 'My Tickets' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=tickets&ticket=ticket-1');
    expect(await screen.findByRole('heading', { name: 'FB-12' })).toBeInTheDocument();
  });
});

describe('SupportPage with no tickets yet', () => {
  it('sends the reporter to the New Ticket tab from the empty state', async () => {
    vi.mocked(feedbackService.listMine).mockResolvedValue({ tickets: [], nextCursor: '' });
    const user = userEvent.setup();
    renderAt('/support');

    await user.click(await screen.findByRole('button', { name: 'Create your first ticket' }));

    expect(screen.getByRole('tab', { name: 'New Ticket' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=new');
  });
});
