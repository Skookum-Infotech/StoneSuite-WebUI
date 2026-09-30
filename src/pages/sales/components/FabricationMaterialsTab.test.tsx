import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/fabricationService', () => ({
  fabricationService: { getJobMaterials: vi.fn(), getJobSlabs: vi.fn(), allocateSlab: vi.fn(), deallocateSlab: vi.fn() },
}));
vi.mock('@/services/inventoryUnitService', () => ({ inventoryUnitService: { searchUnits: vi.fn() } }));
vi.mock('@/lib/requisitionPrefill', () => ({ openRequisitionForShortages: vi.fn() }));

import { FabricationMaterialsTab } from './FabricationMaterialsTab';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { fabricationService } from '@/services/fabricationService';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { openRequisitionForShortages } from '@/lib/requisitionPrefill';
import type { FabricationMaterial } from '@/types/fabrication';

const mat = (over: Partial<FabricationMaterial> = {}): FabricationMaterial => ({
  itemId: 'i1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT',
  ordered: 60, needed: 32.292, basis: 'blueprint', pieceCount: 1,
  allocated: 0, consumed: 0, inStock: 90.416, shortfall: 32.292, ...over,
});

function can(...granted: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => granted.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderTab(materials: FabricationMaterial[], canAllocate = true) {
  vi.mocked(fabricationService.getJobMaterials).mockResolvedValue(materials);
  vi.mocked(fabricationService.getJobSlabs).mockResolvedValue([]);
  vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FabricationMaterialsTab jobId="job-1" pieces={[]} canAllocate={canAllocate} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  can('inventory_unit:read', 'requisition:create');
});

describe('FabricationMaterialsTab', () => {
  it('shows a card for each material and says how many still need slab', async () => {
    renderTab([mat(), mat({ itemId: 'i2', sku: 'MARB-9', name: 'Carrara', allocated: 30, shortfall: 0 })]);

    expect(await screen.findByRole('region', { name: 'Absolute Black material' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Carrara material' })).toBeInTheDocument();
    expect(screen.getByText('1 material needs more slab allocated before this job can move to Cutting.')).toBeInTheDocument();
  });

  it('says the job has what it needs once every material is covered', async () => {
    renderTab([mat({ allocated: 45.208, shortfall: 0 })]);

    expect(await screen.findByText(/every material is covered/i)).toBeInTheDocument();
  });

  it('explains when the order has no slab material to allocate against', async () => {
    renderTab([]);

    expect(await screen.findByText(/has no slab material lines/i)).toBeInTheDocument();
    // Whatever slabs are held still list below.
    expect(await screen.findByRole('table', { name: 'Slabs allocated to this job' })).toBeInTheDocument();
  });

  it('opens the slab picker for a material', async () => {
    renderTab([mat()]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Allocate slabs of Absolute Black' }));

    expect(screen.getByRole('dialog', { name: 'Allocate Absolute Black' })).toBeInTheDocument();
  });

  it('offers no allocating to a user without the right to', async () => {
    renderTab([mat()], false);
    await screen.findByRole('region', { name: 'Absolute Black material' });

    expect(screen.queryByRole('button', { name: /allocate slabs of/i })).not.toBeInTheDocument();
  });

  it('offers no picker to a user who may not list slabs', async () => {
    can('requisition:create');
    renderTab([mat()]);
    await screen.findByRole('region', { name: 'Absolute Black material' });

    expect(screen.queryByRole('button', { name: /allocate slabs of/i })).not.toBeInTheDocument();
  });

  it('starts a requisition for what stock itself lacks', async () => {
    renderTab([mat({ shortfall: 50, inStock: 45.208 })]);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Create a requisition for Absolute Black' }));

    expect(openRequisitionForShortages).toHaveBeenCalledWith([expect.objectContaining({
      itemId: 'i1', requested: 50, available: 45.208, short: 50 - 45.208,
    })]);
  });

  it('offers no requisition to a user who may not create one', async () => {
    can('inventory_unit:read');
    renderTab([mat({ shortfall: 50, inStock: 45.208 })]);
    await screen.findByRole('region', { name: 'Absolute Black material' });

    expect(within(screen.getByRole('region', { name: 'Absolute Black material' })).queryByRole('button', { name: /requisition/i })).not.toBeInTheDocument();
  });

  it('says so when the materials cannot be loaded', async () => {
    vi.mocked(fabricationService.getJobMaterials).mockRejectedValue(new Error('boom'));
    vi.mocked(fabricationService.getJobSlabs).mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <FabricationMaterialsTab jobId="job-1" pieces={[]} canAllocate />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Failed to load materials.')).toBeInTheDocument();
  });
});
