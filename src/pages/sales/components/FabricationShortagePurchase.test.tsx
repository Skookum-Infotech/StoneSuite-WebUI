import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FabricationShortagePurchase } from './FabricationShortagePurchase';
import { tenantClient } from '@/api/tenantClient';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
vi.mock('@/api/tenantClient', () => ({ tenantClient: { get: vi.fn(), post: vi.fn() }, apiErrorMessage: () => 'Connection failed; retry.' }));
vi.mock('@/services/fabricationTemplateService', () => ({ fabricationTemplateService: { list: vi.fn() } }));
vi.mock('@/pages/purchases/purchase-order/components/VendorPicker', () => ({ VendorPicker: ({ onChange }: { onChange: (value: { id: string; name: string }) => void }) => <button type="button" onClick={() => onChange({ id: 'vendor', name: 'Stone supplier' })}>Select supplier</button> }));
function mount() {
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FabricationShortagePurchase jobId="job" version={12} materials={[]} canReadPurchase /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(tenantClient.get).mockResolvedValue({ data: { action: { enabled: true, blockers: [] } } });
  vi.mocked(fabricationTemplateService.list).mockResolvedValue([{ id: 'template', state: 'approved', jobVersion: 1, revision: 1, salesOrderVersion: 1, baseline: [], change: { internalRequired: false, customerRequired: false, changedLines: [] }, createdAt: '2026-10-03T00:00:00Z', lines: [{ sourceLineId: 'line', materialId: 'stone', scope: 'Kitchen', quantity: 1, unitPrice: 12, pieces: [{ name: 'Island', lengthMm: 1500, widthMm: 600, thicknessMm: 30 }] }] }]);
});
describe('Shortage purchase', () => {
  it('disables purchasing and explains server blockers', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { action: { enabled: false, blockers: [{ code: 'job_state', message: 'Resume the job first.' }] } } });
    mount();
    expect(await screen.findByText('Resume the job first.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Select supplier' })).toBeDisabled();
    expect(tenantClient.post).not.toHaveBeenCalled();
  });
  it('fails closed when availability cannot be loaded', async () => {
    vi.mocked(tenantClient.get).mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to check purchase availability');
    expect(screen.getByRole('button', { name: 'Select supplier' })).toBeDisabled();
  });
  it('submits distinct measured requirements together and allows removing an extra row', async () => {
    vi.mocked(fabricationTemplateService.list).mockResolvedValue([{ id: 'template', state: 'approved', jobVersion: 1, revision: 1, salesOrderVersion: 1, baseline: [], change: { internalRequired: false, customerRequired: false, changedLines: [] }, createdAt: '2026-10-03T00:00:00Z', lines: [
      { sourceLineId: 'first', materialId: 'stone', scope: 'Kitchen', quantity: 1, unitPrice: 12, pieces: [] },
      { sourceLineId: 'second', materialId: 'stone', scope: 'Bathroom', quantity: 1, unitPrice: 12, pieces: [] },
    ] }]);
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { result: { relatedId: 'po' } } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Select supplier' }));
    fireEvent.change(screen.getByLabelText('Measured requirement'), { target: { value: 'first' } });
    fireEvent.change(screen.getByLabelText('Quantity (catalog units)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Quoted unit price'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add measured requirement' }));
    expect(screen.getByRole('button', { name: 'Create linked draft purchase order' })).toBeDisabled();
    expect(screen.getAllByRole('option', { name: 'Line 1 · Kitchen' })[1]).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove purchase line 2' }));
    expect(screen.getByLabelText('Quantity (catalog units)')).toHaveValue(40);
    fireEvent.click(screen.getByRole('button', { name: 'Add measured requirement' }));
    fireEvent.change(screen.getAllByLabelText('Measured requirement')[1], { target: { value: 'second' } });
    fireEvent.change(screen.getAllByLabelText('Quantity (catalog units)')[1], { target: { value: '20' } });
    fireEvent.change(screen.getAllByLabelText('Quoted unit price')[1], { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Why is more material needed?'), { target: { value: 'Both rooms need material' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create linked draft purchase order' }));
    await waitFor(() => expect(tenantClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ requirements: [
      { sourceLineId: 'first', quantity: 40, unitPrice: 12 },
      { sourceLineId: 'second', quantity: 20, unitPrice: 15 },
    ] })));
    expect(await screen.findByRole('link', { name: 'Review purchase order' })).toBeVisible();
    expect(screen.getAllByLabelText('Measured requirement')).toHaveLength(1);
  });
  it('requires an approved measured template', async () => {
    vi.mocked(fabricationTemplateService.list).mockResolvedValue([]);
    mount();
    expect(await screen.findByText('Approve the template before purchasing missing material.')).toBeVisible();
    expect(tenantClient.post).not.toHaveBeenCalled();
  });
  it('creates a linked draft and retries with the same request identity', async () => {
    vi.mocked(tenantClient.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { result: { relatedId: 'po' } } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Select supplier' }));
    fireEvent.change(screen.getByLabelText('Measured requirement'), { target: { value: 'line' } });
    fireEvent.change(screen.getByLabelText('Quantity (catalog units)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Quoted unit price'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Expected slabs (optional)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Why is more material needed?'), { target: { value: 'No remnant fits the island' } });
    const button = screen.getByRole('button', { name: 'Create linked draft purchase order' });
    fireEvent.click(button);
    await screen.findByRole('alert');
    const first = vi.mocked(tenantClient.post).mock.calls[0];
    expect(first).toEqual(['/tenant/fabrication-jobs/job/shortage-purchase-orders', expect.objectContaining({ expectedVersion: 12, requestId: expect.any(String), templateId: 'template', vendorId: 'vendor', reason: 'No remnant fits the island', requirements: [{ sourceLineId: 'line', quantity: 40, unitPrice: 12, expectedSlabs: 1 }] })]);
    fireEvent.click(button);
    await waitFor(() => expect(tenantClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(tenantClient.post).mock.calls[1]).toEqual(first);
    expect(await screen.findByRole('link', { name: 'Review purchase order' })).toHaveAttribute('href', '/purchases/purchase_order/po');
  });
});
