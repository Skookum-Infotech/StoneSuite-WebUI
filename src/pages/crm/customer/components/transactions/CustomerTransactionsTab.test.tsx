import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';
import { pickOption } from '@/test/selectHelpers';

vi.mock('@/services/customerTransactionsService', () => ({
  customerTransactionsService: { list: vi.fn(), summary: vi.fn() },
}));

import { CustomerTransactionsTab } from './CustomerTransactionsTab';
import { customerTransactionsService } from '@/services/customerTransactionsService';
import type {
  CustomerTransactionRow, CustomerTransactionsOverview, CustomerTransactionsPage,
} from '@/types/customerTransactions';

const list = vi.mocked(customerTransactionsService.list);
const summary = vi.mocked(customerTransactionsService.summary);

function makeRow(o: Partial<CustomerTransactionRow> = {}): CustomerTransactionRow {
  return {
    type: 'invoice', typeLabel: 'Invoice', domain: 'sales', module: 'invoice', id: 'inv-1',
    number: 'INV-1001', status: 'Sent', statusCode: 'SENT', date: '2026-10-01', dueDate: '2026-10-31',
    amount: 1250, balance: 400, isOpen: true, isOverdue: false,
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T09:00:00Z', ...o,
  };
}

function makeOverview(o: Partial<CustomerTransactionsOverview> = {}): CustomerTransactionsOverview {
  return {
    scopeLimited: false,
    summary: {
      openBalance: 400, openInvoiceCount: 1, overdueBalance: 0, overdueInvoiceCount: 0,
      unappliedCredits: 50, billed12m: 9800, paid12m: 9400, lastActivityAt: '2026-10-02T09:00:00Z',
    },
    counts: [{ type: 'invoice', count: 12, openCount: 1, statuses: [{ code: 'SENT', label: 'Sent', count: 1 }] }],
    types: [
      { type: 'invoice', label: 'Invoice', domain: 'sales', module: 'invoice' },
      { type: 'quote', label: 'Quote', domain: 'sales', module: 'quote' },
    ],
    ...o,
  };
}

function serve(rows: CustomerTransactionRow[], total = rows.length) {
  list.mockImplementation(async (_id, q): Promise<CustomerTransactionsPage> => ({
    rows, total, page: q.page ?? 1, limit: q.limit ?? 25,
  }));
}

const realMatchMedia = window.matchMedia;
function setViewport(wide: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (query: string): MediaQueryList => ({
      matches: query.includes('min-width: 1024px') ? wide : false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {},
      removeListener: () => {}, dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function renderTab(search = '?tab=transactions') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/crm/customer/c-1${search}`]}>
        <CustomerTransactionsTab customerId="c-1" />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerTransactionsTab', () => {
  beforeEach(() => {
    list.mockReset();
    summary.mockReset();
    setViewport(true);
    summary.mockResolvedValue(makeOverview());
    serve([makeRow()]);
  });
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: realMatchMedia });
  });

  it('shows a spinner while loading', () => {
    list.mockReturnValue(new Promise(() => {}));
    summary.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.getByText('Loading transactions…')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    list.mockRejectedValue(new Error('boom'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    serve([makeRow()]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('INV-1001')).toBeInTheDocument();
  });

  it('a 404 does not reveal whether the customer exists', async () => {
    const err = new AxiosError('nope', '404', undefined, undefined, {
      status: 404, data: { message: 'Record not found.' }, statusText: '', headers: {}, config: {} as never,
    });
    summary.mockRejectedValue(err);
    list.mockRejectedValue(err);
    renderTab();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Transactions are not available for this customer.');
    expect(alert).not.toHaveTextContent(/not found|exist/i);
  });

  it('explains when the caller can read no transaction types', async () => {
    summary.mockResolvedValue(makeOverview({ types: [] }));
    serve([]);
    renderTab();
    expect(await screen.findByText(/don't have access to any transaction types/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by type')).toBeNull();
  });

  it('shows the unfiltered empty state', async () => {
    serve([]);
    renderTab();
    expect(await screen.findByText('No transactions for this customer yet')).toBeInTheDocument();
  });

  it('shows the filtered empty state and clears filters', async () => {
    serve([]);
    renderTab('?tab=transactions&type=invoice&open=1');
    expect(await screen.findByText('No matching transactions')).toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\?tab=transactions$/));
  });

  it('renders the overdue badge and links the row to its record', async () => {
    serve([makeRow({ isOverdue: true })]);
    renderTab();
    expect(await screen.findByText('Overdue', { selector: 'span.inline-block' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Invoice INV-1001' })).toHaveAttribute('href', '/sales/invoice/inv-1');
  });

  it('uses cards below lg', async () => {
    setViewport(false);
    renderTab();
    await screen.findByText('INV-1001');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: 'View Invoice INV-1001' })).toHaveAttribute('href', '/sales/invoice/inv-1');
  });

  it('a filter writes the URL, keeps tab, and resets the page', async () => {
    serve([makeRow()], 100);
    renderTab('?tab=transactions&page=3');
    await screen.findByText('INV-1001');
    await pickOption(screen.getByRole('combobox', { name: 'Filter by type' }), 'invoice');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('?tab=transactions&type=invoice'));
    expect(screen.getByTestId('loc')).not.toHaveTextContent('page=');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('c-1', expect.objectContaining({ type: 'invoice', page: 1 })));
  });

  it('the open toggle writes open=1', async () => {
    renderTab();
    await screen.findByText('INV-1001');
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Open items only' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('open=1'));
  });

  it('the status filter appears only once a type is chosen', async () => {
    renderTab();
    await screen.findByText('INV-1001');
    expect(screen.queryByRole('combobox', { name: 'Filter by status' })).toBeNull();
  });

  it('reads the status filter from the URL', async () => {
    renderTab('?tab=transactions&type=invoice&status=SENT');
    expect(await screen.findByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledWith('c-1', expect.objectContaining({ type: 'invoice', status: 'SENT' })));
  });

  it('paging writes page to the URL', async () => {
    serve([makeRow()], 80);
    renderTab();
    await screen.findByText('INV-1001');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('page=2'));
  });

  it('debounces the number search into the URL', async () => {
    renderTab();
    await screen.findByText('INV-1001');
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search by document number' }), 'INV-9');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('q=INV-9'));
  });
});
