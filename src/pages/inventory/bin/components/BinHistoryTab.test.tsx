import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { getHistory: vi.fn() } }));

import { inventoryBinService } from '@/services/inventoryBinService';
import { BinHistoryTab } from './BinHistoryTab';
import type { BinHistoryEntry } from '@/types/inventory';

const getHistory = vi.mocked(inventoryBinService.getHistory);

const entry = (over: Partial<BinHistoryEntry>): BinHistoryEntry => ({
  action: 'bin_move', direction: 'in', unitId: 'u-1', unitSerial: 'SLB-000231',
  at: '2026-10-14T10:42:00', byName: 'Maria Lopez', ...over,
});

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/inventory/bin/bin-1']}>
        <Routes>
          <Route path="/inventory/bin/:id" element={<BinHistoryTab binId="bin-1" />} />
          <Route path="/inventory/bin_transfer/:id" element={<p>transfer page</p>} />
          <Route path="/inventory/unit/:id" element={<p>unit page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('BinHistoryTab', () => {
  it('reads each event as moved in, moved out, cut or scrapped, with where from and who', async () => {
    getHistory.mockResolvedValue({
      records: [
        entry({ direction: 'in', fromBinPath: 'YARD/A1', transferId: 'bt-12', transferNumber: 'BTRF-000012' }),
        entry({ unitSerial: 'SLB-000118', unitId: 'u-2', direction: 'out', toBinPath: 'SAW-2' }),
        entry({ unitSerial: 'SLB-000097', unitId: 'u-3', action: 'cut', direction: 'out', byName: 'Sam Ortiz' }),
      ],
      nextCursor: '', hasMore: false,
    });
    renderTab();

    // "Moved in" / "Moved out" are also filter chips, so read the events from the list.
    expect(await screen.findByText('from YARD/A1')).toBeInTheDocument();
    const events = within(screen.getByRole('list'));
    expect(events.getByText('Moved in')).toBeInTheDocument();
    expect(events.getByText('Moved out')).toBeInTheDocument();
    expect(events.getByText('to SAW-2')).toBeInTheDocument();
    expect(events.getByText('Cut')).toBeInTheDocument();
    expect(events.getByText(/Sam Ortiz/)).toBeInTheDocument();
  });

  it('links the slab and the transfer that moved it', async () => {
    getHistory.mockResolvedValue({
      records: [entry({ transferId: 'bt-12', transferNumber: 'BTRF-000012' })],
      nextCursor: '', hasMore: false,
    });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'BTRF-000012' }));

    expect(await screen.findByText('transfer page')).toBeInTheDocument();
  });

  it('asks only for arrivals when "Moved in" is chosen', async () => {
    getHistory.mockResolvedValue({ records: [entry({})], nextCursor: '', hasMore: false });
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('from no bin');

    await user.click(screen.getByRole('button', { name: 'Moved in' }));

    await waitFor(() => expect(getHistory).toHaveBeenLastCalledWith('bin-1', expect.objectContaining({ direction: 'in' })));
  });

  it('pages back through older activity with the cursor the server gave', async () => {
    getHistory
      .mockResolvedValueOnce({ records: [entry({ unitSerial: 'SLB-NEW', unitId: 'u-9' })], nextCursor: 'cursor-2', hasMore: true })
      .mockResolvedValueOnce({ records: [entry({ unitSerial: 'SLB-OLD', unitId: 'u-8' })], nextCursor: '', hasMore: false });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Show earlier activity' }));

    expect(await screen.findByText('SLB-OLD')).toBeInTheDocument();
    expect(screen.getByText('SLB-NEW')).toBeInTheDocument();
    expect(getHistory).toHaveBeenLastCalledWith('bin-1', expect.objectContaining({ cursor: 'cursor-2' }));
  });

  it('says so when nothing has moved through the bin', async () => {
    getHistory.mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    renderTab();

    expect(await screen.findByText(/No slab has been moved into or out of this bin yet/)).toBeInTheDocument();
  });

  it('surfaces why the history could not be read', async () => {
    getHistory.mockRejectedValue(new Error('You do not have permission to read inventory units.'));
    renderTab();

    expect(await screen.findByText('You do not have permission to read inventory units.')).toBeInTheDocument();
  });
});
