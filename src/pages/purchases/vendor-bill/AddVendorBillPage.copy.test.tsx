import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: vi.fn(() => ({ isPrompting: false, confirmLeave: vi.fn(), cancelLeave: vi.fn(), markClean: vi.fn() })),
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'SQFT' }));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ countries: [], states: [], currencies: [] }) },
}));
vi.mock('@/services/vendorBillService', () => ({
  vendorBillService: { getVendorBill: vi.fn(), createVendorBill: vi.fn() },
}));
vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return { ...actual, documentExtractionService: { get: vi.fn(), complete: vi.fn(), discard: vi.fn(), list: vi.fn() } };
});
vi.mock('./components/VendorBillFormBody', () => ({
  VendorBillFormBody: ({ vendor, lineItems, purchaseOrder, data }: {
    vendor: { name: string } | null;
    lineItems: Array<{ itemName?: string; purchaseOrderItemId?: string | null }>;
    purchaseOrder: { number: string } | null;
    data: Record<string, unknown>;
  }) => (
    <div>
      <p data-testid="form-vendor">{vendor?.name ?? 'none'}</p>
      <p data-testid="form-po">{purchaseOrder?.number ?? 'none'}</p>
      <p data-testid="form-line">{lineItems[0]?.itemName ?? 'none'}</p>
      <p data-testid="form-po-line">{lineItems[0]?.purchaseOrderItemId ?? 'none'}</p>
      <p data-testid="form-invoice">{String(data.vendor_invoice_number ?? '')}</p>
      <p data-testid="form-memo">{String(data.memo ?? '')}</p>
    </div>
  ),
}));

import AddVendorBillPage from './AddVendorBillPage';
import { vendorBillService } from '@/services/vendorBillService';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { VendorBill } from '@/types/vendorBill';

const SOURCE = {
  id: 'vb-4', vendorBillNumber: 'VB-4', status: 'Approved', vendorInvoiceNumber: 'INV-778', billDate: '2020-01-01',
  dueDate: '2020-02-01', memo: 'Freight', adjustment: 0, salesTaxPercent: 0,
  purchaseOrder: { id: 'po-1', purchaseOrderNumber: 'PO-8' },
  vendor: { id: 'v-1', name: 'Stone Co' }, customFields: {},
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 4, unitCode: 'SQFT',
    unitPrice: 12, discountPercent: 0, lineSubtotal: 48, lineDiscount: 0, lineTotal: 48,
    inventoryItemId: 'inv-1', purchaseOrderItemId: 'poi-1',
  }],
} as unknown as VendorBill;

function renderPage(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/purchases/vendor_bill/new" element={<AddVendorBillPage />} />
          <Route path="/purchases/vendor_bill" element={<p>Bill list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(SOURCE);
  vi.mocked(vendorBillService.createVendorBill).mockResolvedValue({ id: 'vb-9', vendorBillNumber: 'VB-9' } as VendorBill);
});

describe('AddVendorBillPage copy (?copyFrom=)', () => {
  it('opens pre-filled from the source bill, minus what belongs to the original', async () => {
    renderPage('/purchases/vendor_bill/new?copyFrom=vb-4');

    expect(await screen.findByTestId('form-vendor')).toHaveTextContent('Stone Co');
    expect(screen.getByTestId('form-memo')).toHaveTextContent('Freight');
    expect(screen.getByTestId('form-line')).toHaveTextContent('Slab');
    expect(screen.getByTestId('form-invoice')).toBeEmptyDOMElement();
    expect(screen.getByTestId('form-po')).toHaveTextContent('none');
    expect(screen.getByTestId('form-po-line')).toHaveTextContent('none');
    // The header renders its subtitle in more than one place.
    expect(screen.getAllByText('Copied from VB-4. Nothing is created until you save.').length).toBeGreaterThan(0);
    expect(vendorBillService.getVendorBill).toHaveBeenCalledWith('vb-4');
  });

  it('creates nothing until Save, then sends a fresh bill with no invoice number or PO link', async () => {
    renderPage('/purchases/vendor_bill/new?copyFrom=vb-4');
    await screen.findByTestId('form-vendor');
    expect(vendorBillService.createVendorBill).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', { name: /^Save Vendor Bill/ })[0]);

    await waitFor(() => expect(vendorBillService.createVendorBill).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(vendorBillService.createVendorBill).mock.calls[0][0];
    expect(payload).toMatchObject({ vendorUuid: 'v-1', vendorInvoiceNumber: '', memo: 'Freight' });
    expect(payload.purchaseOrderUuid).toBeUndefined();
    expect(payload.items[0]).toMatchObject({ inventoryItemUuid: 'inv-1' });
    expect(payload.items[0]).not.toHaveProperty('purchaseOrderItemId', 'poi-1');
    expect(await screen.findByText('Bill list')).toBeInTheDocument();
  });

  it('treats a copy as unsaved work from the start, so leaving prompts', async () => {
    renderPage('/purchases/vendor_bill/new?copyFrom=vb-4');
    await screen.findByTestId('form-vendor');
    const startDirty = vi.mocked(useUnsavedChangesGuard).mock.calls.map((c) => c[2]);
    expect(startDirty.at(-1)).toBe(true);
  });

  it('shows one generic message, not the form, when the source cannot be loaded', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockRejectedValue(new Error('404'));
    renderPage('/purchases/vendor_bill/new?copyFrom=vb-4');
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't be loaded to copy");
    expect(screen.queryByTestId('form-vendor')).not.toBeInTheDocument();
  });

  it('opens a blank form, loading nothing, without copyFrom', async () => {
    renderPage('/purchases/vendor_bill/new');
    expect(await screen.findByTestId('form-vendor')).toHaveTextContent('none');
    expect(vendorBillService.getVendorBill).not.toHaveBeenCalled();
    expect(screen.getAllByText('Fields marked * are required.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Copied from/)).not.toBeInTheDocument();
  });
});
