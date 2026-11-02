import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';

vi.mock('@/services/vendorTransactionsService', () => ({
  vendorTransactionsService: { list: vi.fn(), summary: vi.fn() },
}));

import { VendorTransactionsTab } from './VendorTransactionsTab';
import { vendorTransactionsService } from '@/services/vendorTransactionsService';
import type {
  VendorTransactionRow, VendorTransactionsOverview, VendorTransactionsPage,
} from '@/types/vendorTransactions';

const list = vi.mocked(vendorTransactionsService.list);
const summary = vi.mocked(vendorTransactionsService.summary);

function makeRow(o: Partial<VendorTransactionRow> = {}): VendorTransactionRow {
  return {
    type: 'vendor_bill', typeLabel: 'Vendor Bill', domain: 'purchases', module: 'vendor_bill', id: 'b-1',
    number: 'BILL-1001', status: 'Approved', statusCode: 'APPV', date: '2026-10-01', dueDate: '2026-10-31',
    amount: 1250, balance: 400, isOpen: true, isOverdue: false,
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T09:00:00Z', ...o,
  };
}

function makeOverview(o: Partial<VendorTransactionsOverview> = {}): VendorTransactionsOverview {
  return {
    scopeLimited: false,
    summary: {
      openBalance: 400, openBillCount: 1, overdueAmount: 0, overdueBillCount: 0,
      unappliedCredits: 50, paid12m: 9400, lastActivityAt: '2026-10-02T09:00:00Z',
    },
    counts: [
      { type: 'vendor_bill', count: 12, openCount: 1, statuses: [{ code: 'APPV', label: 'Approved', count: 1 }] },
      { type: 'purchase_order', count: 3, openCount: 1, statuses: [] },
    ],
    types: [
      { type: 'vendor_bill', label: 'Vendor Bill', domain: 'purchases', module: 'vendor_bill' },
      { type: 'purchase_order', label: 'Purchase Order', domain: 'purchases', module: 'purchase_order' },
    ],
    ...o,
  };
}

function serve(rows: VendorTransactionRow[], nextCursor = '') {
  list.mockImplementation(async (_id, q): Promise<VendorTransactionsPage> => ({
    rows, nextCursor, limit: q.limit ?? 25,
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
      <MemoryRouter initialEntries={[`/purchases/vendor/v-1${search}`]}>
        <VendorTransactionsTab vendorId="v-1" />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VendorTransactionsTab', () => {
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
    expect(await screen.findByText('BILL-1001')).toBeInTheDocument();
  });

  it('a 404 does not reveal whether the vendor exists', async () => {
    const err = new AxiosError('nope', '404', undefined, undefined, {
      status: 404, data: { message: 'Vendor not found.' }, statusText: '', headers: {}, config: {} as never,
    });
    summary.mockRejectedValue(err);
    list.mockRejectedValue(err);
    renderTab();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Transactions are not available for this vendor.');
    expect(alert).not.toHaveTextContent(/not found|exist/i);
  });

  it('shows the empty state, and a filtered empty state with a way out', async () => {
    serve([]);
    renderTab();
    expect(await screen.findByText('No transactions for this vendor yet')).toBeInTheDocument();
  });

  it('renders the summary strip, rows linking to their documents, and count badges', async () => {
    renderTab();
    expect(await screen.findByText('Open balance')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'View Vendor Bill BILL-1001' });
    expect(link).toHaveAttribute('href', '/purchases/vendor_bill/b-1');
    expect(screen.getByRole('button', { name: 'Show Vendor Bill, 12 documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show All, 15 documents' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a count badge filters by type and writes it to the URL', async () => {
    renderTab();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Show Purchase Order, 3 documents' }));
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('type=purchase_order'));
    expect(screen.getByTestId('loc')).toHaveTextContent('tab=transactions');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('v-1', expect.objectContaining({ type: 'purchase_order' })));
  });

  it('restores filters and the cursor from the URL (survives a refresh)', async () => {
    renderTab('?tab=transactions&type=vendor_bill&open=1&cursor=abc');
    await screen.findByText('BILL-1001');
    expect(list).toHaveBeenCalledWith('v-1', expect.objectContaining({ type: 'vendor_bill', open: true, cursor: 'abc' }));
    expect(screen.getByRole('button', { name: 'Show Vendor Bill, 12 documents' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('pages forward with the server cursor and back again', async () => {
    list.mockImplementation(async (_id, q) => (
      q.cursor === 'next-1'
        ? { rows: [makeRow({ id: 'b-2', number: 'BILL-1002' })], nextCursor: '', limit: 25 }
        : { rows: [makeRow()], nextCursor: 'next-1', limit: 25 }
    ));
    renderTab();
    const user = userEvent.setup();
    await screen.findByText('BILL-1001');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('BILL-1002')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('cursor=next-1');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('BILL-1001')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).not.toHaveTextContent('cursor=');
  });

  it('after a refresh on a later page, Previous is off but First page works', async () => {
    renderTab('?tab=transactions&cursor=abc');
    await screen.findByText('BILL-1001');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'First page' }));
    await waitFor(() => expect(screen.getByTestId('loc')).not.toHaveTextContent('cursor='));
  });

  it('renders cards instead of the table on a phone', async () => {
    setViewport(false);
    renderTab();
    expect(await screen.findByRole('link', { name: 'View Vendor Bill BILL-1001' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the caller can read no transaction types', async () => {
    summary.mockResolvedValue(makeOverview({ types: [], counts: [] }));
    renderTab();
    expect(await screen.findByText("You don't have access to any transaction types for this vendor.")).toBeInTheDocument();
  });
});
