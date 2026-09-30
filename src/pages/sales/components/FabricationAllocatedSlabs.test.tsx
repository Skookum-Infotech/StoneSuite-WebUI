import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/fabricationService', () => ({
  fabricationService: { getJobSlabs: vi.fn(), deallocateSlab: vi.fn() },
}));

import { FabricationAllocatedSlabs } from './FabricationAllocatedSlabs';
import { fabricationService } from '@/services/fabricationService';
import type { FabricationSlab } from '@/types/fabrication';

const slab = (over: Partial<FabricationSlab>): FabricationSlab => ({
  id: 's1', serial: 'PO-1-001', vendorId: null, inventoryItemId: 'i1', warehouseId: 1,
  lengthMm: 3000, widthMm: 1400, thicknessMm: 30, area: 45.208, form: 'full', status: 'reserved', ...over,
});

function renderList(slabs: FabricationSlab[], canRelease = true) {
  vi.mocked(fabricationService.getJobSlabs).mockResolvedValue(slabs);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FabricationAllocatedSlabs jobId="job-1" canRelease={canRelease} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fabricationService.deallocateSlab).mockResolvedValue(undefined);
});

describe('FabricationAllocatedSlabs', () => {
  it('lists the slabs held for the job with their allocation status', async () => {
    renderList([slab({}), slab({ id: 's2', serial: 'PO-1-002', status: 'consumed' })]);

    expect(await screen.findByText('PO-1-001')).toBeInTheDocument();
    expect(screen.getByText('reserved')).toBeInTheDocument();
    expect(screen.getByText('consumed')).toBeInTheDocument();
  });

  it('says so when nothing is allocated yet', async () => {
    renderList([]);

    expect(await screen.findByText('No slabs allocated to this job yet.')).toBeInTheDocument();
  });

  it('lets a reserved slab be released, but never a slab that has been cut', async () => {
    renderList([slab({}), slab({ id: 's2', serial: 'PO-1-002', status: 'consumed' })]);
    await screen.findByText('PO-1-001');

    expect(screen.getByRole('button', { name: 'Release slab PO-1-001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release slab PO-1-002' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Release slab PO-1-001' }));
    await waitFor(() => expect(fabricationService.deallocateSlab).toHaveBeenCalledWith('job-1', 's1'));
  });

  it('offers no release to a user who may not allocate', async () => {
    renderList([slab({})], false);
    await screen.findByText('PO-1-001');

    expect(screen.queryByRole('button', { name: /release slab/i })).not.toBeInTheDocument();
  });

  it('shows why a release was refused', async () => {
    vi.mocked(fabricationService.deallocateSlab).mockRejectedValue(new Error('A cut slab cannot be released.'));
    renderList([slab({})]);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Release slab PO-1-001' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A cut slab cannot be released.');
  });
});
