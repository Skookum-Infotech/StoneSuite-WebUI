import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/fabricationService', () => ({
  fabricationService: { getJobSlabs: vi.fn(), deallocateSlab: vi.fn() },
}));

import type * as TenantClientModule from '@/api/tenantClient';
import { tenantClient } from '@/api/tenantClient';
vi.mock('@/api/tenantClient', async (importOriginal) => ({ ...await importOriginal<typeof TenantClientModule>(), tenantClient: { post: vi.fn() } }));

import { FabricationAllocatedSlabs } from './FabricationAllocatedSlabs';
import { fabricationService } from '@/services/fabricationService';
import type { FabricationSlab } from '@/types/fabrication';

const slab = (over: Partial<FabricationSlab>): FabricationSlab => ({
  id: 's1', serial: 'PO-1-001', vendorId: null, inventoryItemId: 'i1', warehouseId: 1,
  lengthMm: 3000, widthMm: 1400, thicknessMm: 30, area: 45.208, form: 'full', status: 'reserved', ...over,
});

function renderList(slabs: FabricationSlab[], canRelease = true, workflowVersion?: number) {
  vi.mocked(fabricationService.getJobSlabs).mockResolvedValue(slabs);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FabricationAllocatedSlabs jobId="job-1" canRelease={canRelease} workflowVersion={workflowVersion} version={8} />
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

  it('releases v2 material through a versioned command and retains its identity on retry', async () => {
    vi.mocked(tenantClient.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} });
    renderList([slab({})], true, 2);
    const button = await screen.findByRole('button', { name: 'Release slab PO-1-001' });
    await userEvent.setup().click(button);
    await screen.findByRole('alert');
    const first = vi.mocked(tenantClient.post).mock.calls[0];
    expect(first).toEqual(['/tenant/fabrication-jobs/job-1/material-releases', expect.objectContaining({ slabId: 's1', expectedVersion: 8, requestId: expect.any(String) })]);
    await userEvent.setup().click(button);
    await waitFor(() => expect(tenantClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(tenantClient.post).mock.calls[1]).toEqual(first);
    expect(fabricationService.deallocateSlab).not.toHaveBeenCalled();
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
