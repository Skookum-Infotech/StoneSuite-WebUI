import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FabricationLayoutAllocation } from './FabricationLayoutAllocation';
import { tenantClient } from '@/api/tenantClient';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { inventoryUnitService } from '@/services/inventoryUnitService';
vi.mock('@/api/tenantClient', () => ({ tenantClient: { post: vi.fn() }, apiErrorMessage: () => 'Reservation failed; retry your layout.' }));
vi.mock('@/services/fabricationTemplateService', () => ({ fabricationTemplateService: { list: vi.fn() } }));
vi.mock('@/services/inventoryUnitService', () => ({ inventoryUnitService: { searchUnits: vi.fn() } }));
function mount() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FabricationLayoutAllocation jobId="job" version={9} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fabricationTemplateService.list).mockResolvedValue([{ id: 'revision', state: 'approved', lines: [{ sourceLineId: 'line', materialId: 'stone', scope: 'Kitchen', pieces: [{ name: 'Island', lengthMm: 1000, widthMm: 600, thicknessMm: 20 }] }] }] as Awaited<ReturnType<typeof fabricationTemplateService.list>>);
  vi.mocked(inventoryUnitService.searchUnits).mockResolvedValue({ records: [{ id: 'slab', serial: 'S-1', form: 'remnant', inspectionStatus: 'accepted', lengthMm: 2000, widthMm: 1000, thicknessMm: 20 }, { id: 'pending', serial: 'PENDING', inspectionStatus: 'pending' }], hasMore: false } as Awaited<ReturnType<typeof inventoryUnitService.searchUnits>>);
});
describe('Reviewed allocation', () => {
  it('requires approved measurements', async () => {
    vi.mocked(fabricationTemplateService.list).mockResolvedValue([]);
    mount();
    expect(await screen.findByText('Approve a measured template before reserving material.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirm layout and reserve' })).not.toBeInTheDocument();
  });
  it('submits placements and physical review and reuses the command after a network failure', async () => {
    vi.mocked(tenantClient.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { success: true } });
    mount();
    fireEvent.change(await screen.findByLabelText('Approved template line'), { target: { value: 'line' } });
    await screen.findByRole('option', { name: /S-1/ });
    expect(screen.queryByRole('option', { name: /PENDING/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Inspected material'), { target: { value: 'slab' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Island/ }));
    fireEvent.change(screen.getByLabelText('Island X position'), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText('Rotate 90°'));
    expect(screen.getByRole('img', { name: 'Proposed slab layout' })).toBeVisible();
    const button = screen.getByRole('button', { name: 'Confirm layout and reserve' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Layout review notes'), { target: { value: 'Grain and outline checked; no defects.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I have checked/ }));
    fireEvent.click(button);
    await screen.findByRole('alert');
    const first = vi.mocked(tenantClient.post).mock.calls[0];
    expect(first).toEqual(['/tenant/fabrication-jobs/job/material-allocations', expect.objectContaining({ requestId: expect.any(String), expectedVersion: 9, slabId: 'slab', templateId: 'revision', sourceLineId: 'line', layout: { placements: [{ pieceIndex: 0, xMm: 50, yMm: 0, rotated: true }], kerfMm: 3, suitabilityConfirmed: true, reviewNote: 'Grain and outline checked; no defects.' } })]);
    fireEvent.click(button);
    await waitFor(() => expect(tenantClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(tenantClient.post).mock.calls[1]).toEqual(first);
    expect(await screen.findByText('Layout saved and material reserved.')).toBeVisible();
  });
});
