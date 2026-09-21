import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackTicketRail } from './FeedbackTicketRail';
import type { FeedbackTicket } from '@/types/feedback';

const BASE: FeedbackTicket = {
  id: 'ticket-12',
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
  rating: 4,
  reporterLastSeenAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
};

const TICKETS: FeedbackTicket[] = [
  BASE,
  {
    ...BASE,
    id: 'ticket-9',
    ticketSeq: 9,
    ticketNumber: 'FB-9',
    category: 'feature_request',
    description: 'Add export to CSV',
    status: 'done',
    rating: null,
  },
];

const IDLE_PAGING = { hasNextPage: false, isFetchingNextPage: false, onLoadMore: vi.fn() };

function renderRail(props: Partial<React.ComponentProps<typeof FeedbackTicketRail>> = {}) {
  return render(
    <FeedbackTicketRail
      tickets={TICKETS}
      selectedId={null}
      onSelect={vi.fn()}
      paging={IDLE_PAGING}
      {...props}
    />,
  );
}

describe('FeedbackTicketRail rows', () => {
  it('shows what identifies each ticket: number, category, description and status', () => {
    renderRail();

    expect(screen.getByText('FB-12')).toBeInTheDocument();
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Totals look wrong')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('FB-9')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows a rating only on the tickets that have one', () => {
    renderRail();

    expect(screen.getAllByLabelText(/^Rated \d out of 5$/)).toHaveLength(1);
    expect(screen.getByLabelText('Rated 4 out of 5')).toBeInTheDocument();
  });

  it('marks only the selected ticket as current', () => {
    renderRail({ selectedId: 'ticket-9' });

    expect(screen.getByRole('button', { name: 'Open ticket FB-9, Done' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Open ticket FB-12, New' })).not.toHaveAttribute('aria-current');
  });

  it('reports which ticket the reporter picked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderRail({ onSelect });

    await user.click(screen.getByRole('button', { name: 'Open ticket FB-9, Done' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('ticket-9');
  });
});

describe('FeedbackTicketRail paging', () => {
  it('offers no "Load more" when the server has nothing further', () => {
    renderRail();

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('asks for the next page when "Load more" is pressed', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    renderRail({ paging: { hasNextPage: true, isFetchingNextPage: false, onLoadMore } });

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // Otherwise a second click would fire a duplicate page request.
  it('disables "Load more" while a page is on its way', () => {
    renderRail({ paging: { hasNextPage: true, isFetchingNextPage: true, onLoadMore: vi.fn() } });

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });
});
