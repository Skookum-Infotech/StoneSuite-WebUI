import { pickOption } from '@/test/selectHelpers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataMemoryRouter } from '@/test/DataMemoryRouter';
import { Route, Routes } from 'react-router-dom';

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: vi.fn() }));
vi.mock('@/hooks/useBinTransferCustomFields', () => ({ useBinTransferCustomFields: () => [] }));
vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { getTree: vi.fn() } }));
vi.mock('@/services/inventoryUnitService', () => ({ inventoryUnitService: { searchUnits: vi.fn() } }));
vi.mock('@/services/binTransferService', () => ({ binTransferService: { create: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { inventoryBinService } from '@/services/inventoryBinService';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { binTransferService } from '@/services/binTransferService';
import { makeUnit } from '@/pages/inventory/unit/components/unitFixtures';
import AddBinTransferPage from './AddBinTransferPage';
import type { Bin, Warehouse } from '@/types/inventory';

const YARD = { id: 'loc-1', warehouseId: 7, name: 'Main Yard', isDefault: true } as unknown as Warehouse;
const RACK = {
  id: 'bin-b2', warehouseId: 'loc-1', name: 'Rack B2', code: 'B2', type: 'rack', path: 'RACK/B2',
  depth: 0, unitCount: 0, overCapacity: false, isActive: true,
} as unknown as Bin;

function renderPage(warehouses: Warehouse[] = [YARD]) {
  vi.mocked(useInventoryLookups).mockReturnValue({
    lookups: { warehouses }, isLoading: false, error: null,
  } as unknown as ReturnType<typeof useInventoryLookups>);
  vi.mocked(inventoryBinService.getTree).mockResolvedValue([RACK]);
  vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({
    records: [
      makeUnit({ id: 'u-1', serial: 'SLB-000231', binId: 'bin-a1', binPath: 'YARD/A1' }),
      makeUnit({ id: 'u-2', serial: 'SLB-000232', binId: 'bin-a1', binPath: 'YARD/A1' }),
    ],
    nextCursor: '', hasMore: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DataMemoryRouter initialEntries={['/inventory/bin_transfer/new']}>
        <Routes>
          <Route path="/inventory/bin_transfer/new" element={<AddBinTransferPage />} />
          <Route path="/inventory/bin_transfer/:id" element={<p>transfer page</p>} />
          <Route path="/inventory/bin_transfer" element={<p>transfer list</p>} />
        </Routes>
      </DataMemoryRouter>
    </QueryClientProvider>,
  );
}

async function addFirstSlab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add slabs' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(await within(dialog).findByRole('checkbox', { name: 'Select SLB-000231' }));
  await user.click(within(dialog).getByRole('button', { name: 'Add 1 slab' }));
}

// jsdom has no scrollIntoView, which the error banner calls to bring itself into view.
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('AddBinTransferPage', () => {
  it('starts on the default location and cannot add slabs before one is chosen', async () => {
    renderPage([{ ...YARD, isDefault: false } as Warehouse]);

    expect(await screen.findByRole('button', { name: 'Add slabs' })).toBeDisabled();
  });

  it('searches the chosen location for movable slabs when adding', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add slabs' }));
    await screen.findByRole('checkbox', { name: 'Select SLB-000231' });

    expect(inventoryUnitService.searchUnits).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.arrayContaining([
        { field: 'warehouse_id', op: 'eq', value: 7 },
        { field: 'status', op: 'in', value: ['available', 'reserved'] },
      ]),
    }));
  });

  it('saves a draft with the slabs and their destinations, then opens the transfer', async () => {
    vi.mocked(binTransferService.create).mockResolvedValue({ id: 'bt-9', number: 'BTRF-000009' } as never);
    const user = userEvent.setup();
    renderPage();

    await addFirstSlab(user);
    await pickOption(
      await screen.findByRole('combobox', { name: 'Destination bin for SLB-000231' }), 'bin-b2');
    await user.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(binTransferService.create).toHaveBeenCalled());
    expect(vi.mocked(binTransferService.create).mock.calls[0][0]).toMatchObject({
      warehouseId: 7,
      lines: [{ unitId: 'u-1', toBinId: 'bin-b2' }],
    });
    expect(await screen.findByText('transfer page')).toBeInTheDocument();
  });

  it('will not save a slab that has no destination, and says which line', async () => {
    const user = userEvent.setup();
    renderPage();

    await addFirstSlab(user);
    await user.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Line 1 (SLB-000231) needs a destination bin.');
    expect(binTransferService.create).not.toHaveBeenCalled();
  });

  it('leaves straight away when nothing has been entered', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole('button', { name: 'Cancel' }))[0]);

    expect(await screen.findByText('transfer list')).toBeInTheDocument();
  });

  it('asks before discarding a draft with slabs on it, and stays when told to', async () => {
    const user = userEvent.setup();
    renderPage();

    await addFirstSlab(user);
    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);

    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.queryByText('transfer list')).not.toBeInTheDocument();
  });

  it('will not save with no slabs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole('button', { name: 'Save Draft' }))[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one slab.');
    expect(binTransferService.create).not.toHaveBeenCalled();
  });

  it('applies one destination to every slab with Move all to', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add slabs' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Select SLB-000231' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Select SLB-000232' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 slabs' }));

    await pickOption(screen.getByRole('combobox', { name: 'Move all slabs to bin' }), 'bin-b2');
    await user.click(screen.getByRole('button', { name: 'Apply to all' }));

    expect(screen.getByRole('combobox', { name: 'Destination bin for SLB-000231' })).toHaveAttribute('data-value', 'bin-b2');
    expect(screen.getByRole('combobox', { name: 'Destination bin for SLB-000232' })).toHaveAttribute('data-value', 'bin-b2');
  });

  it('shows a slab that is already on the transfer as added rather than hiding it', async () => {
    const user = userEvent.setup();
    renderPage();

    await addFirstSlab(user);
    await user.click(screen.getByRole('button', { name: 'Add slabs' }));
    const dialog = await screen.findByRole('dialog');

    const box = await within(dialog).findByRole('checkbox', { name: 'Select SLB-000231' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(within(dialog).getByText('Already added')).toBeInTheDocument();
  });
});
