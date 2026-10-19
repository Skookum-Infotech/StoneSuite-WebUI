import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/binTransferService', () => ({ binTransferService: { search: vi.fn() } }));
vi.mock('@/lib/csvExport', () => ({ exportPagedCsv: vi.fn().mockResolvedValue(undefined) }));

import { binTransferService } from '@/services/binTransferService';
import { exportPagedCsv } from '@/lib/csvExport';
import { BinTransferTable } from './BinTransferTable';
import { makeTransfer } from './binTransferFixtures';
import type { BinTransferSearchRequest } from '@/types/binTransfer';

const search = vi.mocked(binTransferService.search);

function renderTable(emptyAction?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/inventory/bin_transfer']}>
        <Routes>
          <Route path="/inventory/bin_transfer" element={<BinTransferTable emptyAction={emptyAction} />} />
          <Route path="/inventory/bin_transfer/:id" element={<p>detail page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function lastRequest(): BinTransferSearchRequest {
  const calls = search.mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({
    records: [
      makeTransfer({ id: 'bt-12', number: 'BTRF-000012', slabCount: 3, totalArea: 162.6, toBinSummary: 'RACK/B2' }),
      makeTransfer({ id: 'bt-13', number: 'BTRF-000013', statusCode: 'PAPV', statusName: 'Pending Approval', slabCount: 1, toBinSummary: '2 bins' }),
    ],
    nextCursor: '', hasMore: false, scope: 'all',
  });
});

describe('BinTransferTable', () => {
  it('lists each transfer with its slabs, destination and status', async () => {
    renderTable();

    const row = (await screen.findByText('BTRF-000012')).closest('tr') as HTMLElement;
    expect(within(row).getByText('3 slabs')).toBeInTheDocument();
    expect(within(row).getByText('RACK/B2')).toBeInTheDocument();
    expect(within(row).getByText('Draft')).toBeInTheDocument();
    const other = screen.getByText('BTRF-000013').closest('tr') as HTMLElement;
    expect(within(other).getByText('1 slab')).toBeInTheDocument();
    expect(within(other).getByText('2 bins')).toBeInTheDocument();
    expect(within(other).getByText('Pending Approval')).toBeInTheDocument();
  });

  it('newest first by default, with no status filter', async () => {
    renderTable();
    await screen.findByText('BTRF-000012');

    expect(lastRequest()).toMatchObject({ sort: [{ field: 'created_at', dir: 'desc' }], filters: [] });
  });

  it('filters by status code from the status chips', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('BTRF-000012');

    await user.click(screen.getByRole('button', { name: 'Pending Approval' }));

    await waitFor(() => expect(lastRequest().filters).toEqual([{ field: 'status_code', op: 'eq', value: 'PAPV' }]));
    expect(screen.getByRole('button', { name: 'Pending Approval' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('searches by slab serial', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('BTRF-000012');

    await user.type(screen.getByRole('textbox', { name: 'Search bin transfers' }), 'SLB-9');

    await waitFor(() => expect(lastRequest().search).toBe('SLB-9'));
  });

  it('opens a transfer from its row', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click((await screen.findByText('BTRF-000013')).closest('tr') as HTMLElement);

    expect(await screen.findByText('detail page')).toBeInTheDocument();
  });

  it('downloads every matching transfer as CSV with the same filters', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('BTRF-000012');

    await user.click(screen.getByRole('button', { name: 'Download bin transfers as CSV' }));

    await waitFor(() => expect(exportPagedCsv).toHaveBeenCalled());
    const [fetchPage, headers, toRow, label] = vi.mocked(exportPagedCsv).mock.calls[0];
    expect(headers).toContain('Number');
    expect(label).toBe('Bin Transfer');
    expect(toRow(makeTransfer({ slabCount: 2 }) as never)).toContain('BTRF-000012');
    await fetchPage('abc');
    expect(lastRequest()).toMatchObject({ cursor: 'abc', limit: 200 });
  });

  it('invites a first transfer when there are none, and offers none when filtered', async () => {
    search.mockResolvedValue({ records: [], nextCursor: '', hasMore: false, scope: 'all' });
    const onNew = vi.fn();
    const user = userEvent.setup();
    renderTable(onNew);

    expect(await screen.findByText('No bin transfers yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Bin Transfer' }));
    expect(onNew).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    expect(await screen.findByText('No bin transfers match the current filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Bin Transfer' })).not.toBeInTheDocument();
  });
});
