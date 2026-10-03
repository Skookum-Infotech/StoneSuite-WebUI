import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FabricationWipTransfers } from './FabricationWipTransfers';
import { tenantClient } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
vi.mock('@/api/tenantClient', () => ({ tenantClient: { get: vi.fn(), post: vi.fn() }, apiErrorMessage: () => 'Unable to move material.' }));
vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { listBins: vi.fn() } }));
function mount(enabled: boolean) {
 vi.mocked(tenantClient.get).mockResolvedValue({ data: { options: [{ slabId: 'slab', serial: 'S-001', warehouseId: 'yard', action: { code: 'transfer_to_wip', label: 'Move to WIP', enabled, blockers: enabled ? [] : [{ code: 'inspection', message: 'Inspect and accept this slab first.' }] } }] } });
 vi.mocked(inventoryBinService.listBins).mockResolvedValue([
  { id: 'bin', warehouseId: 'yard', warehouseName: 'Main', path: 'SAW-1', isWip: true, isActive: true },
  { id: 'other', warehouseId: 'elsewhere', warehouseName: 'Other', path: 'OTHER-SAW', isWip: true, isActive: true },
 ] as Awaited<ReturnType<typeof inventoryBinService.listBins>>);
 render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FabricationWipTransfers jobId="job" version={7} /></QueryClientProvider>);
}
describe('WIP movement', () => {
 beforeEach(() => vi.clearAllMocks());
 it('explains server blockers and prevents a blocked action', async () => {
  mount(false);
  fireEvent.change(await screen.findByLabelText('Allocated slab'), { target: { value: 'slab' } });
  expect(screen.getByText('Inspect and accept this slab first.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Move to WIP' })).toBeDisabled();
  expect(tenantClient.post).not.toHaveBeenCalled();
 });
 it('offers same-location WIP bins and submits the versioned action', async () => {
  vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });
  mount(true);
  fireEvent.change(await screen.findByLabelText('Allocated slab'), { target: { value: 'slab' } });
  expect(screen.queryByRole('option', { name: /OTHER-SAW/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Destination WIP bin'), { target: { value: 'bin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Move to WIP' }));
  await waitFor(() => expect(tenantClient.post).toHaveBeenCalledWith('/tenant/fabrication-jobs/job/wip-transfers', expect.objectContaining({ expectedVersion: 7, slabId: 'slab', binId: 'bin', requestId: expect.any(String) })));
  expect(await screen.findByText('Material moved to WIP.')).toBeVisible();
 });
});
