import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ isPrompting: false, confirmLeave: vi.fn(), cancelLeave: vi.fn(), markClean: vi.fn() }),
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'SQFT' }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ hasPermission: () => false }) }));
vi.mock('@/services/lookupService', () => ({
  lookupService: {
    getCrmLookups: vi.fn().mockResolvedValue({
      countries: [{ id: 1, name: 'United States', code: 'US' }],
      states: [{ id: 44, name: 'Texas', code: 'TX', countryId: 1 }],
      currencies: [],
    }),
  },
}));
vi.mock('@/services/companyProfileService', () => ({ companyProfileService: { get: vi.fn() } }));
vi.mock('@/services/companyLocationService', () => ({ companyLocationService: { list: vi.fn() } }));
vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { createPurchaseOrder: vi.fn() } }));
vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return { ...actual, documentExtractionService: { get: vi.fn(), complete: vi.fn(), discard: vi.fn(), list: vi.fn() } };
});
vi.mock('./components/PurchaseOrderFormBody', () => ({
  PurchaseOrderFormBody: ({ vendor, setVendor, lineItems, data }: {
    vendor: { name: string } | null; setVendor: (v: { id: string; name: string }) => void; lineItems: unknown[];
    data: Record<string, unknown>;
  }) => (
    <div>
      <p data-testid="form-vendor">{vendor?.name ?? 'none'}</p>
      <p data-testid="form-lines">{lineItems.length}</p>
      <p data-testid="form-ref">{String(data.reference_number ?? '')}</p>
      <p data-testid="form-city">{String(data.ship_city ?? '')}</p>
      <button type="button" onClick={() => setVendor({ id: 'v9', name: 'Picked Vendor' })}>Pick vendor in form</button>
    </div>
  ),
}));

import AddPurchaseOrderPage from './AddPurchaseOrderPage';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { documentExtractionService as svc } from '@/services/documentExtractionService';
import { toast } from 'sonner';
import { extraction, f } from '@/test/documentExtractionFixtures';
import { vendorDoc } from '@/test/purchaseDocFixtures';
import type { PurchaseOrder } from '@/types/purchaseOrder';

const PO = { id: 'po-77', purchaseOrderNumber: 'PO-2001' } as PurchaseOrder;
const saveButtons = (): HTMLElement[] => screen.getAllByRole('button', { name: /^Save Purchase Order/ });

function renderPage(url = '/purchases/purchase_order/new?fromDocument=ex-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/purchases/purchase_order/new" element={<AddPurchaseOrderPage />} />
          <Route path="/purchases/purchase_order" element={<p>PO list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ready = (doc = vendorDoc({ header: { poNumber: f('Q-778') } })) => extraction(doc, { docType: 'purchase_order', fileName: 'quote.pdf' });

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(svc.complete).mockResolvedValue(undefined);
  vi.mocked(svc.discard).mockResolvedValue(undefined);
  vi.mocked(svc.list).mockResolvedValue([]);
});

describe('AddPurchaseOrderPage review mode', () => {
  it('prefills the vendor, reference and lines from the extraction', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    renderPage();
    expect(await screen.findByRole('banner', { name: 'Reviewing quote.pdf' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('form-vendor')).toHaveTextContent('Marble Supply Co'));
    expect(screen.getByTestId('form-ref')).toHaveTextContent('Q-778');
    expect(screen.getByTestId('form-lines')).toHaveTextContent('1');
    expect(screen.getAllByRole('heading', { name: /New Purchase Order from Document/ }).length).toBeGreaterThan(0);
    expect(saveButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true);
  });

  it('keeps Save disabled until the vendor is picked, and a manual pick keeps the document values', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready(vendorDoc({
      vendor: null, header: { poNumber: f('Q-778') },
    })));
    renderPage();
    const save = await screen.findByRole('button', { name: /Save Purchase Order\. Disabled: 1 required item to review/ });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Pick vendor in form' }));
    await waitFor(() => expect(saveButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true));
    expect(screen.getByTestId('form-vendor')).toHaveTextContent('Picked Vendor');
    expect(screen.getByTestId('form-ref')).toHaveTextContent('Q-778');
  });

  it('uses the document ship-to whole instead of mixing in company defaults', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready(vendorDoc({ header: { shipTo: f('12 Oak Lane\nCelina 75009') } })));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('form-city')).toHaveTextContent('Celina'));
  });

  it('saves with the vendor, tells the server what was saved and returns to the list', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    vi.mocked(purchaseOrderService.createPurchaseOrder).mockResolvedValue(PO);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('form-vendor')).toHaveTextContent('Marble Supply Co'));
    await userEvent.click(saveButtons()[0]);
    await waitFor(() => expect(svc.complete).toHaveBeenCalledWith('ex-1', expect.objectContaining({
      recordUuid: 'po-77',
      saved: expect.objectContaining({ vendorUuid: 'ven-1', poNumber: 'Q-778', lines: [{ docSku: 'QZ-3CM', docDescription: 'Quartz slab 3cm', itemUuid: 'item-1' }] }),
    })));
    expect(vi.mocked(purchaseOrderService.createPurchaseOrder).mock.calls[0][0]).toMatchObject({ vendorUuid: 'ven-1', referenceNumber: 'Q-778' });
    expect(toast.success).toHaveBeenCalledWith('Purchase Order PO-2001 created from quote.pdf', expect.anything());
    expect(await screen.findByText('PO list')).toBeInTheDocument();
  });

  it('shows why a document failed instead of an empty review', async () => {
    vi.mocked(svc.get).mockResolvedValue(extraction(undefined, { docType: 'purchase_order', status: 'failed', failureCode: 'scanned', failureMessage: 'quote.pdf is a scan.' }));
    renderPage();
    expect(await screen.findByText('quote.pdf is a scan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enter the purchase order manually' })).toHaveAttribute('href', '/purchases/purchase_order/new');
  });

  it('discards after confirmation', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Discard this document and its changes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard document' }));
    await waitFor(() => expect(svc.discard).toHaveBeenCalledWith('ex-1'));
    expect(await screen.findByText('PO list')).toBeInTheDocument();
  });

  it('leaves manual create untouched without ?fromDocument', async () => {
    renderPage('/purchases/purchase_order/new');
    expect((await screen.findAllByRole('button', { name: 'Save Purchase Order' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('banner', { name: /Reviewing/ })).not.toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
  });
});
