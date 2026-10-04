import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantClient } from '@/api/tenantClient';
import { FabricationProcurement } from './FabricationProcurement';
vi.mock('@/api/tenantClient', () => ({ tenantClient: { get: vi.fn() }, apiErrorMessage: () => 'Unable to load linked purchases.' }));
function mount() { render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FabricationProcurement jobId="job" /></QueryClientProvider></MemoryRouter>); }
beforeEach(() => vi.resetAllMocks());
describe('Linked fabrication purchases', () => {
  it('shows receipt progress per unit and preserves revision context', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { orders: [{ id: 'po', number: 'PO-123', status: 'Partially received', statusCode: 'PART', vendor: 'Stone supplier', expectedDate: '2026-10-05', templateRevision: 1, templateState: 'superseded', reason: 'Island requires full slab', lines: [{ number: 1, material: 'Marble', unit: 'SQFT', ordered: 40, received: 15 }, { number: 2, material: 'Trim', unit: 'EA', ordered: 2, received: 2 }] }] } });
    mount();
    expect(await screen.findByRole('link', { name: 'PO-123' })).toHaveAttribute('href', '/purchases/purchase_order/po');
    expect(screen.getByText('Not yet received: 25 SQFT')).toBeVisible();
    expect(screen.getByText('Ordered: 2 EA · Received: 2 EA')).toBeVisible();
    expect(screen.getByText('Ordered quantity received; check inspection separately.')).toBeVisible();
    expect(screen.getByText(/Template revision 1 · superseded/)).toBeVisible();
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/fabrication-jobs/job/shortage-purchase-orders');
  });
  it('does not claim that an access-filtered empty result means no orders exist', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { orders: [] } });
    mount();
    expect(await screen.findByText('No linked purchase orders are visible with your current access.')).toBeVisible();
  });
  it('reports a failed read instead of presenting an empty list', async () => {
    vi.mocked(tenantClient.get).mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load linked purchases.');
    expect(screen.queryByText('No linked purchase orders are visible with your current access.')).not.toBeInTheDocument();
  });
});
