import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/fabricationService', () => ({ fabricationService: { allocateSlab: vi.fn() } }));
vi.mock('@/services/inventoryUnitService', () => ({ inventoryUnitService: { searchUnits: vi.fn() } }));

import { AllocateSlabsDialog } from './AllocateSlabsDialog';
import { fabricationService } from '@/services/fabricationService';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { makeUnit } from '@/pages/inventory/unit/components/unitFixtures';
import type { FabricationJobPiece, FabricationMaterial } from '@/types/fabrication';

const material = (over: Partial<FabricationMaterial> = {}): FabricationMaterial => ({
  itemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT',
  ordered: 60, needed: 60, basis: 'order', pieceCount: 0,
  allocated: 0, consumed: 0, inStock: 135, shortfall: 60, ...over,
});

const BIG = makeUnit({ id: 'big', serial: 'PO-1-001', area: 50, lengthMm: 3000, widthMm: 1550 });
const MID = makeUnit({ id: 'mid', serial: 'PO-1-002', area: 30, lengthMm: 2500, widthMm: 1100 });
const SMALL = makeUnit({ id: 'small', serial: 'PO-1-003', area: 20, kind: 'remnant', lengthMm: 1800, widthMm: 1000, binPath: 'Yard / A1' });

function renderDialog(opts: { material?: FabricationMaterial; pieces?: FabricationJobPiece[]; onClose?: () => void; units?: ReturnType<typeof makeUnit>[] } = {}) {
  vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({
    records: opts.units ?? [BIG, MID, SMALL], nextCursor: '', hasMore: false,
  });
  const onClose = opts.onClose ?? vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AllocateSlabsDialog jobId="job-1" material={opts.material ?? material()} pieces={opts.pieces ?? []} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fabricationService.allocateSlab).mockResolvedValue(undefined);
});

describe('AllocateSlabsDialog', () => {
  it('lists only this material\'s unallocated slabs, biggest first', async () => {
    renderDialog();
    await screen.findByText('PO-1-001');

    expect(inventoryUnitService.searchUnits).toHaveBeenCalledWith(expect.objectContaining({
      filters: [
        { field: 'item_id', op: 'eq', value: 'item-1' },
        { field: 'status', op: 'eq', value: 'available' },
      ],
      sort: [{ field: 'area', dir: 'desc' }],
    }));
    expect(screen.getByText('3000 × 1550 × 30')).toBeInTheDocument();
    expect(screen.getByText('Yard / A1')).toBeInTheDocument();
    expect(screen.getByText('remnant')).toBeInTheDocument();
  });

  it('says how much is still to allocate and how much is in stock', async () => {
    renderDialog();

    expect(await screen.findByText(/60 sq ft still to allocate\./)).toBeInTheDocument();
    expect(screen.getByText(/135 sq ft in stock\./)).toBeInTheDocument();
  });

  it('adds up what is selected against what is still short', async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Select PO-1-002' }));
    const summary = screen.getByText(/selected/).closest('p') as HTMLElement;
    expect(summary).toHaveTextContent('30 sq ft selected (1 slab) · 30 sq ft still short');

    await user.click(screen.getByRole('checkbox', { name: 'Select PO-1-001' }));
    expect(summary).toHaveTextContent('80 sq ft selected (2 slabs) · covers what is needed');
    expect(screen.getByRole('button', { name: 'Allocate 2 slabs' })).toBeEnabled();
  });

  it('selects the fewest slabs that cover the gap when asked for the best fit', async () => {
    renderDialog({ material: material({ shortfall: 25, needed: 25 }) });
    const user = userEvent.setup();
    await screen.findByText('PO-1-001');

    await user.click(screen.getByRole('button', { name: /suggest best fit/i }));

    // 25 sq ft: the 30 covers it alone, and is the smallest that does.
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-002' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-001' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-003' })).not.toBeChecked();
  });

  it('has nothing to suggest for a material that is already covered', async () => {
    renderDialog({ material: material({ shortfall: 0 }) });
    await screen.findByText('PO-1-001');

    expect(screen.getByRole('button', { name: /suggest best fit/i })).toBeDisabled();
  });

  it('allocates the selected slabs one after another, then closes', async () => {
    const onClose = renderDialog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Select PO-1-001' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select PO-1-002' }));

    await user.click(screen.getByRole('button', { name: 'Allocate 2 slabs' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(fabricationService.allocateSlab).mock.calls).toEqual([
      ['job-1', 'big', undefined],
      ['job-1', 'mid', undefined],
    ]);
  });

  it('allocates to a chosen piece when there are pieces', async () => {
    const pieces = [{ id: 'piece-1', pieceNumber: 1, pieceName: 'Island' } as FabricationJobPiece];
    renderDialog({ pieces });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Select PO-1-001' }));

    await user.selectOptions(screen.getByLabelText('Piece to allocate to'), 'piece-1');
    await user.click(screen.getByRole('button', { name: 'Allocate 1 slab' }));

    await waitFor(() => expect(fabricationService.allocateSlab).toHaveBeenCalledWith('job-1', 'big', 'piece-1'));
  });

  it('keeps what was allocated, and the rest selected, when one slab is refused part-way', async () => {
    const refusal = Object.assign(new Error('Slab is reserved and cannot be allocated.'), {});
    vi.mocked(fabricationService.allocateSlab).mockImplementation(async (_job, slab) => {
      if (slab === 'mid') throw refusal;
    });
    const onClose = renderDialog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Select PO-1-001' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select PO-1-002' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select PO-1-003' }));

    await user.click(screen.getByRole('button', { name: 'Allocate 3 slabs' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 of 3 allocated. Slab is reserved and cannot be allocated.');
    expect(onClose).not.toHaveBeenCalled();
    expect(fabricationService.allocateSlab).toHaveBeenCalledTimes(2); // the third was never tried
    // The one that went through is no longer selected; the others are, for a retry.
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-001' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-002' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select PO-1-003' })).toBeChecked();
  });

  it('cannot allocate until something is selected', async () => {
    renderDialog();
    await screen.findByText('PO-1-001');

    expect(screen.getByRole('button', { name: 'Allocate' })).toBeDisabled();
  });

  it('says so when none of the material is in stock', async () => {
    renderDialog({ units: [] });

    expect(await screen.findByText('No unallocated Absolute Black is in stock.')).toBeInTheDocument();
  });

  it('searches within the material', async () => {
    renderDialog();
    await screen.findByText('PO-1-001');

    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Search slabs' }), 'LOT-7');

    await waitFor(() => expect(inventoryUnitService.searchUnits).toHaveBeenCalledWith(expect.objectContaining({ search: 'LOT-7' })));
  });

  it('closes on Cancel and on Escape', async () => {
    const onClose = renderDialog();
    const user = userEvent.setup();
    await screen.findByText('PO-1-001');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
