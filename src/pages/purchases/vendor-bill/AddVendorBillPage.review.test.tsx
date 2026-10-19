import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ isPrompting: false, confirmLeave: vi.fn(), cancelLeave: vi.fn(), markClean: vi.fn() }),
}));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'SQFT' }));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn().mockResolvedValue({ countries: [], states: [], currencies: [] }) },
}));
vi.mock('@/services/vendorBillService', () => ({ vendorBillService: { createVendorBill: vi.fn() } }));
vi.mock('@/services/documentExtractionService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService');
  return { ...actual, documentExtractionService: { get: vi.fn(), complete: vi.fn(), discard: vi.fn(), list: vi.fn() } };
});
vi.mock('./components/VendorBillFormBody', () => ({
  VendorBillFormBody: ({ vendor, setVendor, lineItems, purchaseOrder, data }: {
    vendor: { name: string } | null; setVendor: (v: { id: string; name: string }) => void;
    lineItems: Array<{ purchaseOrderItemId?: string | null }>; purchaseOrder: { number: string } | null;
    data: Record<string, unknown>;
  }) => (
    <div>
      <p data-testid="form-vendor">{vendor?.name ?? 'none'}</p>
      <p data-testid="form-po">{purchaseOrder?.number ?? 'none'}</p>
      <p data-testid="form-po-line">{lineItems[0]?.purchaseOrderItemId ?? 'none'}</p>
      <p data-testid="form-invoice">{String(data.vendor_invoice_number ?? '')}</p>
      <p data-testid="form-terms">{String(data.payment_terms ?? '')}</p>
      <button type="button" onClick={() => setVendor({ id: 'v9', name: 'Picked Vendor' })}>Pick vendor in form</button>
    </div>
  ),
}));

import AddVendorBillPage from './AddVendorBillPage';
import { vendorBillService } from '@/services/vendorBillService';
import { documentExtractionService as svc } from '@/services/documentExtractionService';
import { toast } from 'sonner';
import { extraction, f } from '@/test/documentExtractionFixtures';
import { vendorDoc } from '@/test/purchaseDocFixtures';
import type { VendorBill } from '@/types/vendorBill';

const BILL = { id: 'vb-77', vendorBillNumber: 'VB-3001' } as VendorBill;
const saveButtons = (): HTMLElement[] => screen.getAllByRole('button', { name: /^Save Vendor Bill/ });

function conflict() {
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
    data: { success: false, code: 'duplicate_document', message: 'A bill with this vendor invoice number already exists (VB-1000).', existingUuid: 'vb-1', existingNumber: 'VB-1000' },
  });
}

function renderPage(url = '/purchases/vendor_bill/new?fromDocument=ex-1') {
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

const LINKED = {
  uuid: 'po-9', number: 'PO-1009', status: 'RCVD', billable: true,
  lines: [{ id: 'poi-1', lineNumber: 1, inventoryItemUuid: 'item-1', description: 'Quartz slab 3cm', qtyMilli: 10_000, billableQtyMilli: 10_000, unitPriceCents: 5000 }],
};
const ready = (over: Parameters<typeof vendorDoc>[0] = {}) => extraction(
  vendorDoc({ docType: 'vendor_bill', header: { invoiceNumber: f('INV-77'), invoiceDate: f('2026-09-05'), poNumber: f('PO-1009') }, linkedPurchaseOrder: LINKED, ...over }),
  { docType: 'vendor_bill', fileName: 'bill.pdf' },
);

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(svc.complete).mockResolvedValue(undefined);
  vi.mocked(svc.discard).mockResolvedValue(undefined);
  vi.mocked(svc.list).mockResolvedValue([]);
});

describe('AddVendorBillPage review mode', () => {
  it('prefills vendor, invoice number, linked PO and the line link', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    renderPage();
    expect(await screen.findByRole('banner', { name: 'Reviewing bill.pdf' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('form-vendor')).toHaveTextContent('Marble Supply Co'));
    expect(screen.getByTestId('form-invoice')).toHaveTextContent('INV-77');
    expect(screen.getByTestId('form-po')).toHaveTextContent('PO-1009');
    expect(screen.getByTestId('form-po-line')).toHaveTextContent('poi-1');
  });

  it('a manual vendor pick keeps the document values but drops the other vendor\'s PO link', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready({ paymentTerms: { id: 2, name: 'Net 30', code: 'N30' } }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('form-po')).toHaveTextContent('PO-1009'));
    await userEvent.click(screen.getByRole('button', { name: 'Pick vendor in form' }));
    await waitFor(() => expect(screen.getByTestId('form-vendor')).toHaveTextContent('Picked Vendor'));
    expect(screen.getByTestId('form-po')).toHaveTextContent('none');
    expect(screen.getByTestId('form-po-line')).toHaveTextContent('none');
    expect(screen.getByTestId('form-invoice')).toHaveTextContent('INV-77');
    expect(screen.getByTestId('form-terms')).toHaveTextContent('2');
  });

  it('sends the PO and line link on create and completes with the invoice number', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    vi.mocked(vendorBillService.createVendorBill).mockResolvedValue(BILL);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('form-po-line')).toHaveTextContent('poi-1'));
    await userEvent.click(saveButtons()[0]);
    await waitFor(() => expect(svc.complete).toHaveBeenCalledWith('ex-1', expect.objectContaining({
      recordUuid: 'vb-77',
      saved: expect.objectContaining({ vendorUuid: 'ven-1', invoiceNumber: 'INV-77', invoiceDate: '2026-09-05', poNumber: 'PO-1009' }),
    })));
    expect(vi.mocked(vendorBillService.createVendorBill).mock.calls[0][0]).toMatchObject({
      vendorUuid: 'ven-1', purchaseOrderUuid: 'po-9', vendorInvoiceNumber: 'INV-77',
      items: [expect.objectContaining({ purchaseOrderItemId: 'poi-1' })],
    });
    expect(toast.success).toHaveBeenCalledWith('Vendor Bill VB-3001 created from bill.pdf', expect.anything());
  });

  it('offers Create anyway on a 409 duplicate and resends with allowDuplicate', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready());
    vi.mocked(vendorBillService.createVendorBill).mockRejectedValueOnce(conflict()).mockResolvedValueOnce(BILL);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('form-vendor')).toHaveTextContent('Marble Supply Co'));
    await userEvent.click(saveButtons()[0]);
    expect(await screen.findByText('This vendor bill may already exist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open existing VB-1000' })).toBeInTheDocument();
    expect(vi.mocked(vendorBillService.createVendorBill).mock.calls[0][0]).not.toHaveProperty('allowDuplicate');
    await userEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(vendorBillService.createVendorBill).toHaveBeenCalledTimes(2));
    expect(vi.mocked(vendorBillService.createVendorBill).mock.calls[1][0]).toMatchObject({ allowDuplicate: true });
  });

  it('keeps Save disabled until the vendor is resolved', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready({ vendor: null }));
    renderPage();
    expect(await screen.findByRole('button', { name: /Save Vendor Bill\. Disabled: 1 required item to review/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Pick vendor in form' }));
    await waitFor(() => expect(saveButtons().every((b) => !b.hasAttribute('disabled'))).toBe(true));
  });

  it('shows the credit-document warning with a link to vendor credits', async () => {
    vi.mocked(svc.get).mockResolvedValue(ready({ extracted: { warnings: ['credit_document'] } }));
    renderPage();
    expect(await screen.findByRole('link', { name: 'New vendor credit' })).toHaveAttribute('href', '/purchases/vendor_credit/new');
  });

  it('manual create also handles the duplicate 409 (Create anyway resends allowDuplicate)', async () => {
    vi.mocked(vendorBillService.createVendorBill).mockRejectedValueOnce(conflict()).mockResolvedValueOnce(BILL);
    renderPage('/purchases/vendor_bill/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Pick vendor in form' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Save Vendor Bill' }))[0]);
    expect(await screen.findByText('This vendor bill may already exist')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(vendorBillService.createVendorBill).toHaveBeenCalledTimes(2));
    expect(vi.mocked(vendorBillService.createVendorBill).mock.calls[1][0]).toMatchObject({ allowDuplicate: true });
    expect(await screen.findByText('Bill list')).toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
  });
});
