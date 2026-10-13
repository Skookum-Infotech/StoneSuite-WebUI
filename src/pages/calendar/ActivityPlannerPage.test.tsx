import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/salesOrderService', () => ({ salesOrderService: { getScheduleFeed: vi.fn() } }));
vi.mock('@/services/invoiceService', () => ({ invoiceService: { searchInvoices: vi.fn() } }));
vi.mock('@/services/lookupService', () => ({ lookupService: { getCrmLookups: vi.fn() } }));

import ActivityPlannerPage from './ActivityPlannerPage';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { salesOrderService } from '@/services/salesOrderService';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
import { addDays, rangeFor } from '@/lib/plannerCalendar';
import type { InvoiceSummary } from '@/types/invoice';
import type { ScheduleFeedEvent } from '@/types/salesOrder';

// A Wednesday far in the future, so scheduled work on it is never "overdue".
const ANCHOR = '2099-03-04';
const WEEK = rangeFor('week', ANCHOR);
const TUESDAY = addDays(WEEK.from, 1);
const THURSDAY = addDays(WEEK.from, 3);

function event(over: Partial<ScheduleFeedEvent> & { orderNumber?: string; orderId?: string } = {}): ScheduleFeedEvent {
  const { orderNumber = 'SO-1042', orderId = 'so-1', ...rest } = over;
  return {
    code: 'template',
    sequence: 2,
    group: 'Template',
    name: 'Template',
    status: 'pending',
    scheduledAt: `${TUESDAY}T09:00:00`,
    notes: '',
    order: {
      id: orderId,
      number: orderNumber,
      customerName: 'Acme Builders',
      status: 'Open',
      statusCode: 'OPEN',
      scheduledInstallDate: '2099-04-01',
    },
    ...rest,
  };
}

function invoice(over: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2077',
    status: 'Sent',
    statusCode: 'SENT',
    approvalStatus: 'approved',
    customer: { id: 'c1', name: 'Acme Builders' },
    salesOrder: { id: 'so-1', number: 'SO-1042' },
    invoiceDate: `${WEEK.from}`,
    dueDate: THURSDAY,
    grandTotal: 1500,
    balanceDue: 1250,
    ...over,
  };
}

// A plain span: <output> carries the "status" role, which the page's own
// banner also uses.
function Probe() {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
}

function setPermissions(grants: { resource: string; action: string }[] | 'all' = 'all') {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    isSuperAdmin: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      grants === 'all' || grants.some((g) => g.resource === resource && g.action === action),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPlanner(search = `?date=${ANCHOR}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/calendar/activity-planner${search}`]}>
        <ActivityPlannerPage />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function serverError(message: string) {
  return new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400, statusText: 'Bad Request', headers: {}, config: { headers: new AxiosHeaders() },
    data: { success: false, message },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setPermissions('all');
  vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [], truncated: false });
  vi.mocked(invoiceService.searchInvoices).mockResolvedValue({ records: [], nextCursor: '', hasMore: false, scope: 'all' });
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue({ currencies: [] } as never);
});

describe('ActivityPlannerPage', () => {
  it('opens on Template with the week around the date, one request for it', async () => {
    renderPlanner();

    expect(await screen.findByRole('table', { name: 'Template calendar' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Template' })).toHaveAttribute('aria-selected', 'true');
    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledWith({
      group: 'Template', from: WEEK.from, to: WEEK.to,
    });
    expect(screen.getAllByRole('columnheader')).toHaveLength(8); // row label + 7 days
  });

  it('offers a tab for every activity', async () => {
    renderPlanner();
    await screen.findByRole('table');

    const labels = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(labels).toEqual([
      'Template', 'Engineering', 'Bin Transfer', 'Saw', 'Edges', 'Quality Control', 'Installation', 'Invoicing',
    ]);
  });

  it('stacks each job card in the column of the day it is planned for', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [
        event({ orderNumber: 'SO-1042', orderId: 'so-1' }),
        event({ orderNumber: 'SO-1050', orderId: 'so-2', scheduledAt: `${TUESDAY}T11:30:00` }),
        event({ orderNumber: 'SO-1061', orderId: 'so-3', scheduledAt: `${THURSDAY}T09:00:00` }),
      ],
      truncated: false,
    });
    renderPlanner();
    await screen.findByText('SO-1042');

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(7);
    const tuesday = within(cells[1]);
    expect(tuesday.getByText('SO-1042')).toBeInTheDocument();
    expect(tuesday.getByText('SO-1050')).toBeInTheDocument();
    expect(tuesday.getByText('9:00 AM')).toBeInTheDocument();
    expect(tuesday.getByText('11:30 AM')).toBeInTheDocument();
    expect(within(cells[3]).getByText('SO-1061')).toBeInTheDocument();
    expect(within(cells[0]).queryByRole('article')).toBeNull();
  });

  it('shows the customer and the status on a card, and links to the order', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner();

    const link = await screen.findByRole('link', { name: /Open SO-1042, Template,/ });
    expect(link).toHaveAttribute('href', '/sales/sales_order/so-1?tab=scheduling');
    const card = link.closest('article') as HTMLElement;
    expect(within(card).getByText('Acme Builders')).toBeInTheDocument();
    expect(within(card).getByText('Pending')).toBeInTheDocument();
    // "Template" is already the tab's name, so the card doesn't repeat it.
    expect(within(card).queryByText('Template')).toBeNull();
  });

  it('names the activity on a card when it says more than the tab does', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ code: 'installation_ready', group: 'Installation', name: 'Installation Ready' })],
      truncated: false,
    });
    renderPlanner();

    const link = await screen.findByRole('link', { name: /Open SO-1042, Installation Ready,/ });
    const card = link.closest('article') as HTMLElement;
    expect(within(card).getByText('Installation Ready')).toBeInTheDocument();
  });

  it('counts the jobs in view and says how many are overdue', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event(), event({ orderId: 'so-2', orderNumber: 'SO-1050' })], truncated: false });
    renderPlanner();

    expect(await screen.findByText(/jobs in this view/)).toHaveTextContent('2 jobs in this view');
    expect(screen.queryByText(/overdue/)).toBeNull();
  });

  it('flags work whose time has passed as overdue', async () => {
    const past = rangeFor('week', '2020-01-08');
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ scheduledAt: `${past.from}T09:00:00` })],
      truncated: false,
    });
    renderPlanner('?date=2020-01-08');

    expect(await screen.findByText('1 overdue')).toBeInTheDocument();
    const card = (await screen.findByRole('link', { name: /Open SO-1042/ })).closest('article') as HTMLElement;
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
  });

  it('says so when nothing is planned', async () => {
    renderPlanner();
    expect(await screen.findByText('Nothing scheduled for Template in this view.')).toBeInTheDocument();
  });

  it('warns when the server cut the list short', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: true });
    renderPlanner();
    expect(await screen.findByText(/Only the first part of this window is shown/)).toBeInTheDocument();
  });

  it('shows the server message and retries on request', async () => {
    vi.mocked(salesOrderService.getScheduleFeed)
      .mockRejectedValueOnce(serverError('The date range can span at most 93 days.'))
      .mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner();

    expect(await screen.findByRole('alert')).toHaveTextContent('The date range can span at most 93 days.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SO-1042')).toBeInTheDocument();
  });
});

describe('ActivityPlannerPage tabs', () => {
  it('loads the chosen activity and keeps it in the address', async () => {
    renderPlanner();
    await screen.findByRole('table', { name: 'Template calendar' });

    await userEvent.click(screen.getByRole('tab', { name: 'Saw' }));

    expect(await screen.findByRole('table', { name: 'Saw calendar' })).toBeInTheDocument();
    expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({ group: 'Saw', from: WEEK.from, to: WEEK.to });
    expect(screen.getByTestId('search')).toHaveTextContent('activity=saw');
  });

  it('asks for "WIP Bin Transfer" when Bin Transfer is chosen', async () => {
    renderPlanner('?activity=bin-transfer&date=' + ANCHOR);
    await screen.findByRole('table', { name: 'Bin Transfer calendar' });

    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledWith({
      group: 'WIP Bin Transfer', from: WEEK.from, to: WEEK.to,
    });
  });

  it('falls back to Template for an activity it does not know', async () => {
    renderPlanner('?activity=nonsense&date=' + ANCHOR);
    expect(await screen.findByRole('table', { name: 'Template calendar' })).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    renderPlanner();
    await screen.findByRole('table');

    screen.getByRole('tab', { name: 'Template' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Engineering' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Invoicing' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists invoices on the Invoicing tab, by due date, linked to the invoice and its order', async () => {
    vi.mocked(invoiceService.searchInvoices).mockResolvedValue({
      records: [invoice()], nextCursor: '', hasMore: false, scope: 'all',
    });
    renderPlanner('?activity=invoicing&date=' + ANCHOR);

    const link = await screen.findByRole('link', { name: /Open invoice INV-2077/ });
    expect(link).toHaveAttribute('href', '/sales/invoice/inv-1');
    expect(screen.getByRole('link', { name: 'Open SO-1042' })).toHaveAttribute(
      'href', '/sales/sales_order/so-1?tab=scheduling',
    );
    expect(invoiceService.searchInvoices).toHaveBeenCalledWith(expect.objectContaining({
      filters: [
        { field: 'due_date', op: 'gte', value: WEEK.from },
        { field: 'due_date', op: 'lte', value: WEEK.to },
      ],
    }));
    expect(salesOrderService.getScheduleFeed).not.toHaveBeenCalled();
    expect(within(screen.getAllByRole('cell')[3]).getByText('INV-2077')).toBeInTheDocument();
  });

  it('follows the server cursor to read a long window of invoices', async () => {
    vi.mocked(invoiceService.searchInvoices)
      .mockResolvedValueOnce({ records: [invoice({ id: 'inv-1' })], nextCursor: 'CURSOR-2', hasMore: true, scope: 'all' })
      .mockResolvedValueOnce({ records: [invoice({ id: 'inv-2', invoiceNumber: 'INV-2078' })], nextCursor: '', hasMore: false, scope: 'all' });
    renderPlanner('?activity=invoicing&date=' + ANCHOR);

    expect(await screen.findByText('INV-2078')).toBeInTheDocument();
    expect(screen.getByText('INV-2077')).toBeInTheDocument();
    expect(invoiceService.searchInvoices).toHaveBeenCalledTimes(2);
    expect(invoiceService.searchInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'CURSOR-2' }));
  });

  it('leaves out invoices with no order and void ones', async () => {
    vi.mocked(invoiceService.searchInvoices).mockResolvedValue({
      records: [
        invoice({ id: 'a', invoiceNumber: 'INV-KEEP' }),
        invoice({ id: 'b', invoiceNumber: 'INV-NO-ORDER', salesOrder: null }),
        invoice({ id: 'c', invoiceNumber: 'INV-VOID', status: 'Void', statusCode: 'VOID' }),
      ],
      nextCursor: '', hasMore: false, scope: 'all',
    });
    renderPlanner('?activity=invoicing&date=' + ANCHOR);

    expect(await screen.findByText('INV-KEEP')).toBeInTheDocument();
    expect(screen.queryByText('INV-NO-ORDER')).toBeNull();
    expect(screen.queryByText('INV-VOID')).toBeNull();
  });

  it('hides the Invoicing tab from someone who cannot read invoices', async () => {
    setPermissions([{ resource: 'sales_order', action: 'read' }]);
    renderPlanner();
    await screen.findByRole('table');

    expect(screen.queryByRole('tab', { name: 'Invoicing' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  it('does not ask for invoices at all when the address names Invoicing but access is missing', async () => {
    setPermissions([{ resource: 'sales_order', action: 'read' }]);
    renderPlanner('?activity=invoicing&date=' + ANCHOR);

    expect(await screen.findByRole('table', { name: 'Template calendar' })).toBeInTheDocument();
    expect(invoiceService.searchInvoices).not.toHaveBeenCalled();
  });
});

describe('ActivityPlannerPage columns and navigation', () => {
  it('steps a week forward and back, and returns to today', async () => {
    renderPlanner();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: addDays(WEEK.from, 7), to: addDays(WEEK.to, 7),
    }));
    expect(screen.getByTestId('search')).toHaveTextContent(`date=${addDays(ANCHOR, 7)}`);

    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: WEEK.from, to: WEEK.to,
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).not.toContain(ANCHOR));
  });

  it('switches the columns to the whole month', async () => {
    renderPlanner();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Month' }));

    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: '2099-03-01', to: '2099-03-31',
    }));
    expect(screen.getAllByRole('cell')).toHaveLength(31);
    expect(screen.getByTestId('search')).toHaveTextContent('view=month');
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
  });

  it('switches the columns to the hours of one day', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ scheduledAt: `${ANCHOR}T09:00:00` }), event({ orderId: 'so-2', orderNumber: 'SO-1050', scheduledAt: `${ANCHOR}T14:00:00` })],
      truncated: false,
    });
    renderPlanner('?view=day&date=' + ANCHOR);
    await screen.findByText('SO-1042');

    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledWith({ group: 'Template', from: ANCHOR, to: ANCHOR });
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(1, 3)).toEqual(['6 AM', '7 AM']);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(14);
    expect(within(cells[3]).getByText('SO-1042')).toBeInTheDocument(); // 9 AM
    expect(within(cells[8]).getByText('SO-1050')).toBeInTheDocument(); // 2 PM
  });

  it('gives Invoicing a single All day column in the Day view', async () => {
    renderPlanner('?activity=invoicing&view=day&date=' + ANCHOR);
    await screen.findByRole('table', { name: 'Invoicing calendar' });

    expect(screen.getAllByRole('cell')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'All day' })).toBeInTheDocument();
  });

  it('jumps to the day the date picker chooses', async () => {
    renderPlanner();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Jump to date' }));
    const day = await screen.findByRole('gridcell', { name: '20' });
    await userEvent.click(within(day).getByRole('button'));

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('date=2099-03-20'));
  });
});

/** `count` jobs on one day, one an hour from 8 AM, each its own order. */
function jobsOn(day: string, count: number): ScheduleFeedEvent[] {
  return Array.from({ length: count }, (_, i) =>
    event({
      orderId: `so-${i}`,
      orderNumber: `SO-${2000 + i}`,
      scheduledAt: `${day}T${String(8 + i).padStart(2, '0')}:00:00`,
    }),
  );
}

describe('ActivityPlannerPage busy days', () => {
  it('folds a busy day behind "Show more" and opens it in place', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 7), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');

    const tuesday = within(screen.getAllByRole('cell')[1]);
    expect(tuesday.getAllByRole('article')).toHaveLength(4);
    expect(tuesday.queryByText('SO-2004')).toBeNull();

    const more = tuesday.getByRole('button', { name: 'Show 3 more jobs for Tue, Mar 3' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);

    expect(tuesday.getAllByRole('article')).toHaveLength(7);
    expect(tuesday.getByText('SO-2006')).toBeInTheDocument();
    await userEvent.click(tuesday.getByRole('button', { name: 'Show fewer jobs for Tue, Mar 3' }));
    expect(tuesday.getAllByRole('article')).toHaveLength(4);
  });

  // The button takes a slot of its own, so folding five would hide only one.
  it('shows five cards in full, with nothing to open', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 5), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');

    const tuesday = within(screen.getAllByRole('cell')[1]);
    expect(tuesday.getAllByRole('article')).toHaveLength(5);
    expect(tuesday.queryByRole('button')).toBeNull();
  });

  it('counts each column’s jobs in its header, and leaves an empty day bare', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [...jobsOn(TUESDAY, 3), event({ orderId: 'so-9', orderNumber: 'SO-2900', scheduledAt: `${THURSDAY}T09:00:00` })],
      truncated: false,
    });
    renderPlanner();
    await screen.findByText('SO-2000');

    expect(screen.getByRole('columnheader', { name: /Tue.*3 jobs/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Thu.*1 job\b/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Mon/ })).not.toHaveTextContent(/job/);
  });

  it('counts the folded cards too, in the page summary', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 9), truncated: false });
    renderPlanner();

    expect(await screen.findByText(/jobs in this view/)).toHaveTextContent('9 jobs in this view');
  });

  it('calls Invoicing work invoices, not jobs', async () => {
    vi.mocked(invoiceService.searchInvoices).mockResolvedValue({
      records: [invoice({ id: 'a' }), invoice({ id: 'b', invoiceNumber: 'INV-2078' })],
      nextCursor: '', hasMore: false, scope: 'all',
    });
    renderPlanner('?activity=invoicing&date=' + ANCHOR);

    expect(await screen.findByText(/invoices in this view/)).toHaveTextContent('2 invoices in this view');
    expect(screen.getByRole('columnheader', { name: /Thu.*2 invoices/ })).toBeInTheDocument();
  });

  // The previous window's cards stay on screen while the next one loads; stating
  // a count for them would describe the wrong week.
  it('holds the count back while the next window loads', async () => {
    renderPlanner();
    await screen.findByText(/jobs in this view/);

    let release: (feed: { events: ScheduleFeedEvent[]; truncated: boolean }) => void = () => {};
    vi.mocked(salesOrderService.getScheduleFeed).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    expect(screen.queryByText(/jobs in this view/)).toBeNull();
    expect(screen.getByRole('table', { name: 'Template calendar' })).toBeInTheDocument();

    release({ events: [], truncated: false });
    expect(await screen.findByText(/jobs in this view/)).toHaveTextContent('0 jobs in this view');
    expect(screen.queryByText('Updating…')).toBeNull();
  });
});

describe('ActivityPlannerPage on a phone', () => {
  const originalMatchMedia = window.matchMedia;

  // Matches only the narrow-screen query the page asks for.
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: /max-width:\s*767px/.test(query),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('lists the days that have work, soonest first, instead of a grid', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [
        ...jobsOn(TUESDAY, 2),
        event({ orderId: 'so-9', orderNumber: 'SO-2900', scheduledAt: `${THURSDAY}T09:00:00` }),
      ],
      truncated: false,
    });
    renderPlanner();
    await screen.findByText('SO-2000');

    expect(screen.queryByRole('table')).toBeNull();
    const days = within(screen.getByRole('list', { name: 'Template by day' })).getAllByRole('listitem');
    expect(days).toHaveLength(2);
    expect(within(days[0]).getByRole('heading', { name: /Tue, Mar 3/ })).toHaveTextContent('2 jobs');
    expect(within(days[0]).getAllByRole('article')).toHaveLength(2);
    expect(within(days[1]).getByRole('heading', { name: /Thu, Mar 5/ })).toHaveTextContent('1 job');
    expect(within(days[1]).getByText('SO-2900')).toBeInTheDocument();
  });

  it('keeps the toolbar, the tabs and the card links', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner();

    const link = await screen.findByRole('link', { name: /Open SO-1042, Template,/ });
    expect(link).toHaveAttribute('href', '/sales/sales_order/so-1?tab=scheduling');
    expect(screen.getByRole('tab', { name: 'Template' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('folds a busy day there as well', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 6), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');

    const day = screen.getByRole('listitem');
    expect(within(day).getAllByRole('article')).toHaveLength(4);
    await userEvent.click(within(day).getByRole('button', { name: /Show 2 more jobs/ }));
    expect(within(day).getAllByRole('article')).toHaveLength(6);
  });

  it('says so when nothing is planned', async () => {
    renderPlanner();

    expect(await screen.findByText('Nothing scheduled for Template in this view.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Template by day' })).toBeNull();
  });
});
