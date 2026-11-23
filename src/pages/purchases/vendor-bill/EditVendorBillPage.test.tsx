import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import type { VendorBill } from '@/types/vendorBill';

vi.mock('@/services/vendorBillService', () => ({
  vendorBillService: { getVendorBill: vi.fn(), updateVendorBill: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({ lookupService: { getCrmLookups: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ isPrompting: false, confirmLeave: vi.fn(), cancelLeave: vi.fn(), markClean: vi.fn() }),
}));
vi.mock('@/hooks/useScrollToError', () => ({ useScrollToError: () => null }));
vi.mock('./components/VendorBillFormBody', () => ({ VendorBillFormBody: () => <p>form body</p> }));

import EditVendorBillPage from './EditVendorBillPage';
import { vendorBillService } from '@/services/vendorBillService';

const BILL = {
  id: 'vb-5', vendorBillNumber: 'VB-5', status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: [],
  vendor: { id: 'v-1', name: 'Marble Supply Co' }, vendorInvoiceNumber: 'INV-1', billDate: '2026-09-01',
  items: [], customFields: {}, salesTaxPercent: 0, adjustment: 0,
} as unknown as VendorBill;

function conflict() {
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() },
    data: { success: false, code: 'duplicate_document', message: 'Another bill already has this invoice number.', existingUuid: 'vb-1', existingNumber: 'VB-1' },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/purchases/vendor_bill/vb-5/edit']}>
        <Routes>
          <Route path="/purchases/vendor_bill/:id/edit" element={<EditVendorBillPage />} />
          <Route path="/purchases/vendor_bill/:id" element={<p>Bill detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(BILL);
});

describe('EditVendorBillPage duplicate invoice number', () => {
  it('asks before saving a duplicate and resends with allowDuplicate on Save anyway', async () => {
    vi.mocked(vendorBillService.updateVendorBill).mockRejectedValueOnce(conflict()).mockResolvedValueOnce(BILL);
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: /Save Changes/ }))[0]);
    expect(await screen.findByText('Another bill already has this invoice number.')).toBeInTheDocument();
    expect(vi.mocked(vendorBillService.updateVendorBill).mock.calls[0][1]).not.toHaveProperty('allowDuplicate');

    await userEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(vendorBillService.updateVendorBill).toHaveBeenCalledTimes(2));
    expect(vi.mocked(vendorBillService.updateVendorBill).mock.calls[1][1]).toMatchObject({ allowDuplicate: true });
    expect(await screen.findByText('Bill detail')).toBeInTheDocument();
  });

  it('cancelling the dialog keeps the page open without resending', async () => {
    vi.mocked(vendorBillService.updateVendorBill).mockRejectedValueOnce(conflict());
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: /Save Changes/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(vendorBillService.updateVendorBill).toHaveBeenCalledTimes(1);
  });
});
