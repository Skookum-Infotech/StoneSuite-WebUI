import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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
import { toISODate } from '@/lib/dateUtils';
import { addDays, rangeFor } from '@/lib/plannerCalendar';
import type { InvoiceSummary } from '@/types/invoice';
import type { ScheduleFeedEvent } from '@/types/salesOrder';

// A Wednesday far in the future, so scheduled work on it is never "overdue".
// Weeks run Sunday to Saturday, so this one is Mar 1–7 and its Tuesday is Mar 3.
const ANCHOR = '2099-03-04';
const WEEK = rangeFor('week', ANCHOR);
const TUESDAY = addDays(WEEK.from, 2);
const THURSDAY = addDays(WEEK.from, 4);

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

// The browser's Back button.
function BrowserBack() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      Browser back
    </button>
  );
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
        <BrowserBack />
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
    // The hour gutter's header and the seven days: no activity-name column.
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.getAllByRole('columnheader').slice(1).map((h) => h.getAttribute('aria-label'))).toEqual([
      'Sun, Mar 1', 'Mon, Mar 2', 'Tue, Mar 3', 'Wed, Mar 4', 'Thu, Mar 5', 'Fri, Mar 6', 'Sat, Mar 7',
    ]);
  });

  it('uses the whole width: no activity-name column or row inside the calendar', async () => {
    renderPlanner();
    const table = await screen.findByRole('table', { name: 'Template calendar' });

    expect(within(table).queryByText('Activity')).toBeNull();
    // The activity is named by the tab above the calendar, not by a row of it.
    expect(within(table).queryByRole('rowheader', { name: 'Template' })).toBeNull();
    expect(within(table).getAllByRole('rowheader').map((h) => h.textContent).slice(0, 2)).toEqual(['00:00', '01:00']);
  });

  it('offers a tab for every activity', async () => {
    renderPlanner();
    await screen.findByRole('table');

    const labels = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(labels).toEqual([
      'Template', 'Engineering', 'Bin Transfer', 'Saw', 'Edges', 'Quality Control', 'Installation', 'Invoicing',
    ]);
  });

  it('puts each job chip on the day, and in the hour row, it is planned for', async () => {
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

    const nine = within(screen.getByRole('cell', { name: 'Tue, Mar 3, 09:00' }));
    expect(nine.getByText('SO-1042')).toBeInTheDocument();
    expect(nine.getByText('09:00')).toBeInTheDocument();
    const eleven = within(screen.getByRole('cell', { name: 'Tue, Mar 3, 11:00' }));
    expect(eleven.getByText('SO-1050')).toBeInTheDocument();
    expect(eleven.getByText('11:30')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: 'Thu, Mar 5, 09:00' })).getByText('SO-1061')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: 'Mon, Mar 2, 09:00' })).queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(3);
  });

  it('shows a job as one line — time, number, customer — filled with its status colour', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner();

    const chip = await screen.findByRole('button', { name: /SO-1042, Acme Builders, Mar 3, 2099, 09:00, Pending/ });
    expect(chip).toHaveTextContent('09:00');
    expect(chip).toHaveTextContent('SO-1042');
    expect(chip).toHaveTextContent('Acme Builders');
    expect(chip.style.backgroundColor).not.toBe('');
    // Nothing but the chip: the card's detail waits behind a press.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('link', { name: /Open SO-1042/ })).toBeNull();
  });

  it('opens a detail card from a chip, with the customer, the status and a link to the order', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ notes: 'Customer on site' })],
      truncated: false,
    });
    renderPlanner();

    await userEvent.click(await screen.findByRole('button', { name: /^SO-1042,/ }));

    const card = within(await screen.findByRole('dialog'));
    expect(card.getByText('SO-1042')).toBeInTheDocument();
    expect(card.getByText('Acme Builders')).toBeInTheDocument();
    expect(card.getByText('Pending')).toBeInTheDocument();
    expect(card.getByText('Mar 3, 2099, 09:00')).toBeInTheDocument();
    expect(card.getByText('Installs Apr 1, 2099')).toBeInTheDocument();
    expect(card.getByText('Customer on site')).toBeInTheDocument();
    // "Template" is already the tab's name, so the card doesn't repeat it.
    expect(card.queryByText('Template')).toBeNull();
    const open = card.getByRole('link', { name: /Open SO-1042, Template,/ });
    expect(open).toHaveAttribute('href', '/sales/sales_order/so-1?tab=scheduling');
    expect(open).toHaveTextContent('Open sales order');
  });

  it('closes the detail card with Escape, and opens it from the keyboard', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner();
    const chip = await screen.findByRole('button', { name: /^SO-1042,/ });

    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(chip).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chip).toHaveFocus();
  });

  it('shows one detail card at a time', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event(), event({ orderId: 'so-2', orderNumber: 'SO-1050', scheduledAt: `${TUESDAY}T11:30:00` })],
      truncated: false,
    });
    renderPlanner();

    await userEvent.click(await screen.findByRole('button', { name: /^SO-1042,/ }));
    expect(within(await screen.findByRole('dialog')).getByText('SO-1042')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^SO-1050,/ }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('SO-1050')).toBeInTheDocument());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('names the activity on a card when it says more than the tab does', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ code: 'installation_ready', group: 'Installation', name: 'Installation Ready' })],
      truncated: false,
    });
    renderPlanner();

    await userEvent.click(await screen.findByRole('button', { name: /^SO-1042,/ }));

    const card = within(await screen.findByRole('dialog'));
    expect(card.getByText('Installation Ready')).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Open SO-1042, Installation Ready,/ })).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole('button', { name: /^SO-1042,.*Overdue$/ }));
    expect(within(await screen.findByRole('dialog')).getByText('Overdue')).toBeInTheDocument();
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

    // Date-only: the chip carries no time, and sits in Thursday's All day row.
    const day = await screen.findByRole('cell', { name: 'Thu, Mar 5, All day' });
    const chip = await within(day).findByRole('button');
    expect(chip).toHaveTextContent('INV-2077');
    expect(chip).not.toHaveTextContent('Due');
    await userEvent.click(chip);

    const card = within(await screen.findByRole('dialog'));
    expect(card.getByText('Due Mar 5, 2099')).toBeInTheDocument();
    expect(card.getByText('$1,250.00 due')).toBeInTheDocument();
    const link = card.getByRole('link', { name: /Open invoice INV-2077/ });
    expect(link).toHaveAttribute('href', '/sales/invoice/inv-1');
    expect(link).toHaveTextContent('Open invoice');
    expect(card.getByRole('link', { name: 'Open SO-1042' })).toHaveAttribute(
      'href', '/sales/sales_order/so-1?tab=scheduling',
    );
    expect(invoiceService.searchInvoices).toHaveBeenCalledWith(expect.objectContaining({
      filters: [
        { field: 'due_date', op: 'gte', value: WEEK.from },
        { field: 'due_date', op: 'lte', value: WEEK.to },
      ],
    }));
    expect(salesOrderService.getScheduleFeed).not.toHaveBeenCalled();
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

  it('switches to a month grid of whole weeks, jobs of the neighbouring days included', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [
        event({ orderId: 'so-1', orderNumber: 'SO-1042', scheduledAt: '2099-03-04T09:00:00' }),
        // April, but drawn in March's last week.
        event({ orderId: 'so-2', orderNumber: 'SO-1050', scheduledAt: '2099-04-02T09:00:00' }),
      ],
      truncated: false,
    });
    renderPlanner();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Month' }));

    // Mar 1, 2099 is a Sunday and Mar 31 a Tuesday: five whole weeks, Mar 1 – Apr 4.
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: '2099-03-01', to: '2099-04-04',
    }));
    expect(await screen.findByText('SO-1050')).toBeInTheDocument();
    expect(screen.getAllByRole('cell')).toHaveLength(35);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(6); // the weekday names, then five weeks
    expect(within(screen.getByRole('cell', { name: 'Wed, Mar 4' })).getByText('SO-1042')).toBeInTheDocument();
    const april = within(screen.getByRole('cell', { name: 'Thu, Apr 2' }));
    expect(april.getByText('SO-1050')).toBeInTheDocument();
    // The first of a month names it.
    expect(within(screen.getByRole('cell', { name: 'Wed, Apr 1' })).getByText('1 Apr')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: 'Sun, Mar 1' })).getByText('1 Mar')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('view=month');
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
  });

  it('opens a month chip’s detail card in place, from any cell', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ scheduledAt: '2099-03-04T09:00:00' })],
      truncated: false,
    });
    renderPlanner('?view=month&date=' + ANCHOR);

    await userEvent.click(await screen.findByRole('button', { name: /^SO-1042,/ }));

    const open = within(await screen.findByRole('dialog')).getByRole('link', { name: /Open SO-1042/ });
    expect(open).toHaveAttribute('href', '/sales/sales_order/so-1?tab=scheduling');
  });

  it('marks today, and only today', async () => {
    renderPlanner('?view=month&date=' + toISODate(new Date()));
    await screen.findByRole('table');

    expect(screen.getAllByRole('cell', { current: 'date' })).toHaveLength(1);
  });

  it('lays one day out as a single column of hour rows', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [
        event({ scheduledAt: `${ANCHOR}T09:00:00` }),
        event({ orderId: 'so-2', orderNumber: 'SO-1050', scheduledAt: `${ANCHOR}T14:00:00` }),
        // Off the working day, but the grid runs all 24 hours: its own row, its own minutes.
        event({ orderId: 'so-3', orderNumber: 'SO-1061', scheduledAt: `${ANCHOR}T05:30:00` }),
        event({ orderId: 'so-4', orderNumber: 'SO-1072', scheduledAt: `${ANCHOR}T23:45:00` }),
      ],
      truncated: false,
    });
    renderPlanner('?view=day&date=' + ANCHOR);
    await screen.findByText('SO-1042');

    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledWith({ group: 'Template', from: ANCHOR, to: ANCHOR });
    const hours = screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(hours).toHaveLength(24);
    expect(hours.slice(0, 2)).toEqual(['00:00', '01:00']);
    expect(hours[23]).toBe('23:00');
    expect(screen.getAllByRole('cell')).toHaveLength(24);
    expect(screen.getByRole('columnheader', { name: 'Wed, Mar 4' })).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: 'Wed, Mar 4, 09:00' })).getByText('SO-1042')).toBeInTheDocument();
    expect(within(screen.getByRole('cell', { name: 'Wed, Mar 4, 14:00' })).getByText('SO-1050')).toBeInTheDocument();
    const early = within(screen.getByRole('cell', { name: 'Wed, Mar 4, 05:00' }));
    expect(early.getByText('SO-1061')).toBeInTheDocument();
    expect(early.getByText('05:30')).toBeInTheDocument();
    const late = within(screen.getByRole('cell', { name: 'Wed, Mar 4, 23:00' }));
    expect(late.getByText('SO-1072')).toBeInTheDocument();
    expect(late.getByText('23:45')).toBeInTheDocument();
  });

  it('opens scrolled to the working day, with the small hours a scroll above it', async () => {
    // jsdom lays nothing out, so give the 06:00 row a position under a 60px header.
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent === '06:00' ? 480 : 0;
    });
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
    try {
      renderPlanner('?view=day&date=' + ANCHOR);
      const table = await screen.findByRole('table', { name: 'Template calendar' });

      expect(table.parentElement?.scrollTop).toBe(420);
      expect(within(table).getAllByRole('rowheader')[0]).toHaveTextContent('00:00');
    } finally {
      top.mockRestore();
      height.mockRestore();
    }
  });

  it('gives Invoicing one All day row, with no hours, in the Day view', async () => {
    renderPlanner('?activity=invoicing&view=day&date=' + ANCHOR);
    await screen.findByRole('table', { name: 'Invoicing calendar' });

    expect(screen.getAllByRole('cell')).toHaveLength(1);
    expect(screen.getByRole('rowheader')).toHaveTextContent('All day');
    expect(screen.getByRole('columnheader', { name: 'Wed, Mar 4' })).toBeInTheDocument();
  });

  it('opens a day from its week header: that date in the Day view, same activity', async () => {
    renderPlanner('?activity=saw&date=' + ANCHOR);
    await screen.findByRole('table', { name: 'Saw calendar' });

    await userEvent.click(screen.getByRole('button', { name: 'Open Thu, Mar 5 in Day view' }));

    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Saw', from: THURSDAY, to: THURSDAY,
    }));
    const search = screen.getByTestId('search');
    expect(search).toHaveTextContent('activity=saw');
    expect(search).toHaveTextContent('view=day');
    expect(search).toHaveTextContent(`date=${THURSDAY}`);
    expect(await screen.findByRole('columnheader', { name: 'Thu, Mar 5' })).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(24);
    // The day you are already on is plain text, not a button to itself.
    expect(screen.queryByRole('button', { name: /in Day view/ })).toBeNull();
  });

  it('opens a day from its month cell, including a neighbouring month’s day', async () => {
    renderPlanner('?view=month&date=' + ANCHOR);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Open Fri, Mar 6 in Day view' }));
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: '2099-03-06', to: '2099-03-06',
    }));
    expect(screen.getByTestId('search')).toHaveTextContent('view=day');

    await userEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await screen.findByRole('cell', { name: 'Thu, Apr 2' });

    await userEvent.click(screen.getByRole('button', { name: 'Open Thu, Apr 2 in Day view' }));
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: '2099-04-02', to: '2099-04-02',
    }));
    expect(screen.getByTestId('search')).toHaveTextContent('date=2099-04-02');
  });

  it('returns to the week or month it was opened from when the browser goes back', async () => {
    renderPlanner('?view=month&date=' + ANCHOR);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Open Tue, Mar 3 in Day view' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('view=day'));

    await userEvent.click(screen.getByRole('button', { name: 'Browser back' }));

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('view=month'));
    expect(screen.getByTestId('search')).toHaveTextContent(`date=${ANCHOR}`);
    expect(await screen.findAllByRole('cell')).toHaveLength(35);
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

/** `count` jobs on one day, one an hour from 08:00, each its own order. */
function jobsOn(day: string, count: number): ScheduleFeedEvent[] {
  return Array.from({ length: count }, (_, i) =>
    event({
      orderId: `so-${i}`,
      orderNumber: `SO-${2000 + i}`,
      scheduledAt: `${day}T${String(8 + i).padStart(2, '0')}:00:00`,
    }),
  );
}

/** `count` jobs all in one hour of one day, each its own order. */
function jobsAt(day: string, hour: number, count: number): ScheduleFeedEvent[] {
  return Array.from({ length: count }, (_, i) =>
    event({
      orderId: `so-${i}`,
      orderNumber: `SO-${2000 + i}`,
      scheduledAt: `${day}T${String(hour).padStart(2, '0')}:00:00`,
    }),
  );
}

describe('ActivityPlannerPage busy days', () => {
  it('folds a busy hour behind "N more", which lists every job without growing the grid', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(TUESDAY, 9, 7), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');

    const hour = within(screen.getByRole('cell', { name: 'Tue, Mar 3, 09:00' }));
    expect(hour.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(3);
    expect(hour.queryByText('SO-2003')).toBeNull();

    const more = hour.getByRole('button', { name: 'Show all 7 jobs for Tue, Mar 3, 09:00' });
    expect(more).toHaveTextContent('4 more');
    await userEvent.click(more);

    const list = within(await screen.findByRole('dialog', { name: 'Tue, Mar 3, 09:00, 7 jobs' }));
    expect(list.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(7);
    expect(list.getByText('SO-2006')).toBeInTheDocument();
    // The cell itself is untouched, so the rows below it don't move.
    expect(hour.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(3);
  });

  it('opens a job’s detail card from the list, and Escape closes the card before the list', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(TUESDAY, 9, 7), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');
    const hour = within(screen.getByRole('cell', { name: 'Tue, Mar 3, 09:00' }));
    await userEvent.click(hour.getByRole('button', { name: 'Show all 7 jobs for Tue, Mar 3, 09:00' }));
    const list = within(await screen.findByRole('dialog', { name: 'Tue, Mar 3, 09:00, 7 jobs' }));

    await userEvent.click(list.getByRole('button', { name: /^SO-2006,/ }));

    const link = await screen.findByRole('link', { name: /Open SO-2006/ });
    expect(link).toHaveAttribute('href', '/sales/sales_order/so-6?tab=scheduling');
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('link', { name: /Open SO-2006/ })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Tue, Mar 3, 09:00, 7 jobs' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('gives a wide Day view room: chips wrap, and a normal day shows without a click', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(ANCHOR, 9, 20), truncated: false });
    renderPlanner('?view=day&date=' + ANCHOR);
    await screen.findByText('SO-2000');

    const hour = within(screen.getByRole('cell', { name: 'Wed, Mar 4, 09:00' }));
    expect(hour.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(20);
    expect(hour.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('still folds an extreme Day view hour, and the list holds all of it', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(ANCHOR, 9, 30), truncated: false });
    renderPlanner('?view=day&date=' + ANCHOR);
    await screen.findByText('SO-2000');

    const hour = within(screen.getByRole('cell', { name: 'Wed, Mar 4, 09:00' }));
    expect(hour.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(23);
    await userEvent.click(hour.getByRole('button', { name: 'Show all 30 jobs for Wed, Mar 4, 09:00' }));

    const list = within(await screen.findByRole('dialog', { name: 'Wed, Mar 4, 09:00, 30 jobs' }));
    expect(list.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(30);
  });

  // The toggle takes a slot of its own, so folding four would hide only one.
  it('shows four chips in full, with nothing to open', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(TUESDAY, 9, 4), truncated: false });
    renderPlanner();
    await screen.findByText('SO-2000');

    const hour = within(screen.getByRole('cell', { name: 'Tue, Mar 3, 09:00' }));
    expect(hour.getAllByRole('button')).toHaveLength(4);
    expect(hour.queryByRole('button', { name: /more/ })).toBeNull();
  });

  it('folds a busy day in the month grid the same way', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 6), truncated: false });
    renderPlanner('?view=month&date=' + ANCHOR);
    await screen.findByText('SO-2000');

    const day = within(screen.getByRole('cell', { name: 'Tue, Mar 3' }));
    expect(day.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(3);
    await userEvent.click(day.getByRole('button', { name: 'Show all 6 jobs for Tue, Mar 3' }));

    const list = within(await screen.findByRole('dialog', { name: 'Tue, Mar 3, 6 jobs' }));
    expect(list.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(6);
    expect(day.getAllByRole('button', { name: /Acme Builders/ })).toHaveLength(3);
  });

  it('counts the folded jobs too, in the page summary', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsAt(TUESDAY, 9, 9), truncated: false });
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
    const day = within(screen.getByRole('cell', { name: 'Thu, Mar 5, All day' }));
    expect(day.getAllByRole('button')).toHaveLength(2);
  });

  // The previous window's chips stay on screen while the next one loads; stating
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

  /** The compact calendar: a week's strip, or a month's grid, of day buttons. */
  function pickADay() {
    return within(screen.getByRole('group', { name: 'Pick a day' }));
  }

  function weekWithWork(): ScheduleFeedEvent[] {
    return [
      ...jobsOn(TUESDAY, 2),
      event({ orderId: 'so-9', orderNumber: 'SO-2900', scheduledAt: `${THURSDAY}T09:00:00` }),
    ];
  }

  it('shows a week strip with each day’s jobs counted, and no desktop grid', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: weekWithWork(), truncated: false });
    renderPlanner();
    await screen.findByRole('button', { name: 'Tue, Mar 3, 2 jobs' });

    expect(screen.queryByRole('table')).toBeNull();
    expect(pickADay().getAllByRole('button').map((d) => d.getAttribute('aria-label'))).toEqual([
      'Sun, Mar 1', 'Mon, Mar 2', 'Tue, Mar 3, 2 jobs', 'Wed, Mar 4', 'Thu, Mar 5, 1 job', 'Fri, Mar 6', 'Sat, Mar 7',
    ]);
    // The date in the address is the selected day.
    expect(pickADay().getByRole('button', { name: 'Wed, Mar 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Nothing scheduled on Wed, Mar 4.')).toBeInTheDocument();
  });

  it('lists the tapped day’s jobs as cards under the strip, without loading again', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: weekWithWork(), truncated: false });
    renderPlanner();

    await userEvent.click(await screen.findByRole('button', { name: 'Tue, Mar 3, 2 jobs' }));

    const list = within(screen.getByRole('region', { name: 'Tue, Mar 3' }));
    expect(list.getAllByRole('article')).toHaveLength(2);
    expect(list.getByText('SO-2000')).toBeInTheDocument();
    expect(list.getByText('SO-2001')).toBeInTheDocument();
    expect(pickADay().getByRole('button', { name: 'Tue, Mar 3, 2 jobs' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent(`date=${TUESDAY}`);
    // The same week is the same window, so the data on hand is enough.
    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledTimes(1);
  });

  it('keeps the toolbar, the tabs and a direct link to the order', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner('?date=' + TUESDAY);

    const link = await screen.findByRole('link', { name: /Open SO-1042, Template,/ });
    expect(link).toHaveAttribute('href', '/sales/sales_order/so-1?tab=scheduling');
    expect(screen.getByRole('tab', { name: 'Template' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a month as a compact grid, and tapping a day selects it in place', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({
      events: [event({ scheduledAt: '2099-03-04T09:00:00' })],
      truncated: false,
    });
    renderPlanner('?view=month&date=' + ANCHOR);
    await screen.findByRole('button', { name: 'Wed, Mar 4, 1 job' });

    expect(pickADay().getAllByRole('button')).toHaveLength(35);
    expect(screen.getByRole('link', { name: /Open SO-1042/ })).toBeInTheDocument();

    await userEvent.click(pickADay().getByRole('button', { name: 'Fri, Mar 6' }));

    const search = screen.getByTestId('search');
    expect(search).toHaveTextContent('date=2099-03-06');
    expect(search).toHaveTextContent('view=month');
    expect(screen.queryByRole('link', { name: /Open SO-1042/ })).toBeNull();
    expect(screen.getByText('Nothing scheduled on Fri, Mar 6.')).toBeInTheDocument();
    expect(salesOrderService.getScheduleFeed).toHaveBeenCalledTimes(1);
  });

  it('moves to the neighbouring month when one of its dimmed days is tapped', async () => {
    renderPlanner('?view=month&date=' + ANCHOR);
    await screen.findByRole('group', { name: 'Pick a day' });

    await userEvent.click(pickADay().getByRole('button', { name: 'Thu, Apr 2' }));

    // April's own grid: Sun Mar 29 through Sat May 2.
    await waitFor(() => expect(salesOrderService.getScheduleFeed).toHaveBeenLastCalledWith({
      group: 'Template', from: '2099-03-29', to: '2099-05-02',
    }));
    expect(screen.getByTestId('search')).toHaveTextContent('date=2099-04-02');
  });

  it('lays a day out as its own list, with no strip to pick from', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: [event()], truncated: false });
    renderPlanner('?view=day&date=' + TUESDAY);

    expect(await screen.findByRole('link', { name: /Open SO-1042/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pick a day' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Tue, Mar 3' })).toBeInTheDocument();
  });

  // The selection is the date, so "Today" has work to do whenever the chosen day
  // isn't today — even inside today's own week.
  it('lets Today bring the selection back after another day was picked', async () => {
    const today = toISODate(new Date());
    renderPlanner('?view=week');
    await screen.findByRole('group', { name: 'Pick a day' });
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeDisabled();

    const other = pickADay().getAllByRole('button').find((b) => b.getAttribute('aria-current') !== 'date') as HTMLElement;
    await userEvent.click(other);
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Go to today' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(`date=${today}`));
    const current = pickADay().getAllByRole('button').find((b) => b.getAttribute('aria-current') === 'date');
    expect(current).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows every job of a busy day, with nothing folded away', async () => {
    vi.mocked(salesOrderService.getScheduleFeed).mockResolvedValue({ events: jobsOn(TUESDAY, 12), truncated: false });
    renderPlanner('?date=' + TUESDAY);
    await screen.findByText('SO-2000');

    const list = within(screen.getByRole('region', { name: 'Tue, Mar 3' }));
    expect(list.getAllByRole('article')).toHaveLength(12);
    expect(list.queryByRole('button')).toBeNull();
  });

  it('says so when nothing is planned', async () => {
    renderPlanner();

    expect(await screen.findByText('Nothing scheduled for Template in this view.')).toBeInTheDocument();
    // The one message, not one for the view and another for the day.
    expect(screen.queryByText(/Nothing scheduled on/)).toBeNull();
  });
});
