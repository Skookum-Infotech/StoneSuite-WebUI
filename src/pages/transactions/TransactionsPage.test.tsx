import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/myTransactionsService', () => ({
  myTransactionsService: { list: vi.fn(), overview: vi.fn() },
}));

import TransactionsPage from './TransactionsPage';
import { myTransactionsService } from '@/services/myTransactionsService';
import type { TransactionRow, TransactionsOverview, TransactionsPage as Page } from '@/types/myTransactions';

const list = vi.mocked(myTransactionsService.list);
const overview = vi.mocked(myTransactionsService.overview);

function makeRow(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    type: 'invoice', typeLabel: 'Invoice', domain: 'sales', module: 'invoice', id: 'inv-1',
    number: 'INV-1001', name: '', account: 'Fontaine Builders', status: 'Pending Approval',
    statusCode: 'PAPV', amount: 1200, role: 'created',
    createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T14:00:00Z',
    ...overrides,
  };
}

const OVERVIEW: TransactionsOverview = {
  summary: { total: 5, created: 3, updated: 2, recent: 4 },
  types: [
    { type: 'invoice', label: 'Invoice', domain: 'sales' },
    { type: 'lead', label: 'Lead', domain: 'crm' },
  ],
};

/** A list endpoint over `total` rows: page N holds INV-<N>, so the page is visible on screen. */
function serveRows(total: number, rowsOnPage: (page: number) => TransactionRow[] = (p) => [
  makeRow({ id: `inv-${p}`, number: `INV-P${p}` }),
]) {
  list.mockImplementation(async (q): Promise<Page> => {
    const page = q.page ?? 1;
    return { rows: rowsOnPage(page), total, page, limit: q.limit ?? 25 };
  });
}

// jsdom has no layout, so the page's wide/narrow switch is driven by matchMedia.
const realMatchMedia = window.matchMedia;
function setViewport(wide: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: query.includes('min-width: 1024px') ? wide : query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    list.mockReset();
    overview.mockReset();
    overview.mockResolvedValue(OVERVIEW);
    setViewport(true);
  });
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: realMatchMedia });
  });

  describe('records', () => {
    it('shows a loading state, then the records with their type, status, amount and role', async () => {
      serveRows(2, () => [
        makeRow(),
        makeRow({
          type: 'lead', typeLabel: 'Lead', domain: 'crm', module: 'lead', id: 'lead-1', number: 'LEAD-1084',
          name: 'Whitmore Residence', account: '', status: 'New', statusCode: '', amount: null, role: 'updated',
        }),
      ]);
      renderPage();

      expect(screen.getByText(/loading your transactions/i)).toBeInTheDocument();
      expect(await screen.findByText('INV-1001')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('$1,200.00')).toBeInTheDocument();

      const leadRow = screen.getByRole('row', { name: /LEAD-1084/ });
      expect(within(leadRow).getByText('Whitmore Residence')).toBeInTheDocument();
      expect(within(leadRow).getByText('Updated')).toBeInTheDocument();
      expect(within(leadRow).getAllByText('—')).toHaveLength(2); // no account, no amount
      expect(within(screen.getByRole('row', { name: /INV-1001/ })).getByText('Created')).toBeInTheDocument();
    });

    it('links each record to its detail page', async () => {
      serveRows(1, () => [makeRow()]);
      renderPage();

      const link = await screen.findByRole('link', { name: /view invoice inv-1001/i });
      expect(link).toHaveAttribute('href', '/sales/invoice/inv-1');
    });

    it('fills the stat cards from the overview', async () => {
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      // Some labels also name a filter button, so pick the stat card's <p>.
      const stat = (label: string) =>
        screen.getAllByText(label).find((el) => el.tagName === 'P')?.parentElement as HTMLElement;
      await waitFor(() => expect(stat('Total records')).toHaveTextContent('5'));
      expect(stat('Created by me')).toHaveTextContent('3');
      expect(stat('Updated by me')).toHaveTextContent('2');
      expect(stat('Last 7 days')).toHaveTextContent('4');
    });
  });

  describe('layout', () => {
    it('renders a table on wide screens', async () => {
      setViewport(true);
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders tappable cards, not a table, on narrow screens', async () => {
      setViewport(false);
      serveRows(1, () => [makeRow()]);
      renderPage();

      const card = await screen.findByRole('link', { name: /view invoice inv-1001/i });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(card).toHaveAttribute('href', '/sales/invoice/inv-1');
      expect(within(card).getByText('Pending Approval')).toBeInTheDocument();
      expect(within(card).getByText('Created')).toBeInTheDocument();
      expect(within(card).getByText('Fontaine Builders')).toBeInTheDocument();
      expect(within(card).getByText('$1,200.00')).toBeInTheDocument();
    });

    it('keeps the same pagination controls on narrow screens', async () => {
      setViewport(false);
      serveRows(60);
      renderPage();

      await screen.findByText('INV-P1');
      expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('asks for the first page at the default page size', async () => {
      serveRows(60);
      renderPage();

      await screen.findByText('INV-P1');
      expect(list).toHaveBeenCalledWith({ role: 'all', type: '', q: '', page: 1, limit: 25 });
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 1–25 of 60');
    });

    it('turns pages with next / previous / numbered / last', async () => {
      const user = userEvent.setup();
      serveRows(60);
      renderPage();

      await screen.findByText('INV-P1');

      await user.click(screen.getByRole('button', { name: 'Next page' }));
      expect(await screen.findByText('INV-P2')).toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 26–50 of 60');

      await user.click(screen.getByRole('button', { name: 'Last page' }));
      expect(await screen.findByText('INV-P3')).toBeInTheDocument();
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 51–60 of 60');
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Page 1' }));
      expect(await screen.findByText('INV-P1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    });

    it('goes back to page 1 when the page size changes', async () => {
      const user = userEvent.setup();
      serveRows(120);
      renderPage();

      await screen.findByText('INV-P1');
      await user.click(screen.getByRole('button', { name: 'Page 3' }));
      await screen.findByText('INV-P3');

      await user.selectOptions(screen.getByRole('combobox', { name: /rows per page/i }), '50');

      await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 50 })));
      expect(await screen.findByText('INV-P1')).toBeInTheDocument();
    });

    it('goes back to page 1 when a filter changes', async () => {
      const user = userEvent.setup();
      serveRows(120);
      renderPage();

      await screen.findByText('INV-P1');
      await user.click(screen.getByRole('button', { name: 'Page 2' }));
      await screen.findByText('INV-P2');

      await user.click(screen.getByRole('button', { name: 'Updated by me' }));

      await waitFor(() =>
        expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'updated', page: 1 })),
      );
    });

    it('steps back to the last real page when the list has shrunk past the requested one', async () => {
      const user = userEvent.setup();
      // 60 rows at first; by the time page 3 is requested only 30 remain.
      list.mockImplementation(async (q): Promise<Page> => {
        const page = q.page ?? 1;
        if (page === 3) return { rows: [], total: 30, page, limit: 25 };
        return { rows: [makeRow({ id: `inv-${page}`, number: `INV-P${page}` })], total: page === 1 ? 60 : 30, page, limit: 25 };
      });
      renderPage();

      await screen.findByText('INV-P1');
      await user.click(screen.getByRole('button', { name: 'Last page' }));

      expect(await screen.findByText('INV-P2')).toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 26–30 of 30');
      expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
    });

    it('does not refetch the stat cards when turning pages', async () => {
      const user = userEvent.setup();
      serveRows(60);
      renderPage();

      await screen.findByText('INV-P1');
      await user.click(screen.getByRole('button', { name: 'Next page' }));
      await screen.findByText('INV-P2');

      expect(overview).toHaveBeenCalledTimes(1);
    });
  });

  describe('filters', () => {
    it('refetches with the role when a role filter is chosen', async () => {
      const user = userEvent.setup();
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      await user.click(screen.getByRole('button', { name: 'Updated by me' }));

      await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'updated', page: 1 })));
    });

    it('refetches with the record type picked from the grouped menu', async () => {
      const user = userEvent.setup();
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      await user.click(screen.getByRole('button', { name: /filter by record type/i }));
      expect(await screen.findByRole('group', { name: 'CRM' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Sales' })).toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: 'Lead' }));

      await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'lead' })));
    });

    it('searches after the user stops typing, not per keystroke', async () => {
      const user = userEvent.setup();
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      await user.type(screen.getByRole('searchbox', { name: /search your transactions/i }), 'fontaine');

      await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'fontaine' })));
      expect(list.mock.calls.filter(([p]) => p.q && p.q !== 'fontaine')).toHaveLength(0);
    });
  });

  describe('empty and error states', () => {
    it('shows a first-run empty state with no filters active and no pagination bar', async () => {
      serveRows(0, () => []);
      renderPage();

      expect(await screen.findByText('No activity yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    });

    it('shows a filtered empty state that can clear the filters', async () => {
      const user = userEvent.setup();
      list.mockImplementation(async (q): Promise<Page> =>
        q.role === 'created'
          ? { rows: [], total: 0, page: 1, limit: 25 }
          : { rows: [makeRow()], total: 1, page: 1, limit: 25 });
      renderPage();

      await screen.findByText('INV-1001');
      await user.click(screen.getByRole('button', { name: 'Created by me' }));
      expect(await screen.findByText('No matching records')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /clear filters/i }));
      expect(await screen.findByText('INV-1001')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All activity' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows the API error with a retry when the first load fails', async () => {
      const user = userEvent.setup();
      list.mockRejectedValueOnce(new Error('You do not have permission to read any record type.'));
      serveRows(1, () => [makeRow()]);
      renderPage();

      expect(await screen.findByText(/do not have permission to read any record type/i)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /try again/i }));
      expect(await screen.findByText('INV-1001')).toBeInTheDocument();
    });

    it('refreshes both the list and the stat cards', async () => {
      const user = userEvent.setup();
      serveRows(1, () => [makeRow()]);
      renderPage();

      await screen.findByText('INV-1001');
      const listCalls = list.mock.calls.length;
      const overviewCalls = overview.mock.calls.length;
      await user.click(screen.getByRole('button', { name: 'Refresh' }));

      await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(listCalls));
      expect(overview.mock.calls.length).toBeGreaterThan(overviewCalls);
    });
  });
});
