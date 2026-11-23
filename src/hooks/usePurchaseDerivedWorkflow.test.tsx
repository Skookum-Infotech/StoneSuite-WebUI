import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePurchaseDerivedWorkflow } from './usePurchaseDerivedWorkflow';

const PO_ID = 'po-1';
const PO_NUMBER = 'PORD-000004';

const mocks = vi.hoisted(() => ({
  getPurchaseOrder: vi.fn(),
  forPurchaseOrder: vi.fn(),
  searchVendorBills: vi.fn(),
  getVendorBill: vi.fn(),
  getPayments: vi.fn(),
  getVendorPayment: vi.fn(),
  searchRequisitions: vi.fn(),
}));

vi.mock('@/services/requisitionService', () => ({ requisitionService: { searchRequisitions: mocks.searchRequisitions } }));
vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { getPurchaseOrder: mocks.getPurchaseOrder } }));
vi.mock('@/services/itemReceiptService', () => ({ itemReceiptService: { forPurchaseOrder: mocks.forPurchaseOrder } }));
vi.mock('@/services/vendorBillService', () => ({
  vendorBillService: { searchVendorBills: mocks.searchVendorBills, getVendorBill: mocks.getVendorBill, getPayments: mocks.getPayments },
}));
vi.mock('@/services/vendorPaymentService', () => ({ vendorPaymentService: { getVendorPayment: mocks.getVendorPayment } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePurchaseDerivedWorkflow from a purchase order page', () => {
  beforeEach(() => {
    mocks.getPurchaseOrder.mockResolvedValue({ id: PO_ID, purchaseOrderNumber: PO_NUMBER, statusCode: 'RCVD', status: 'Received', vendor: { id: 'v-1', name: 'Acme Stone' } });
    mocks.searchRequisitions.mockResolvedValue({
      records: [
        { id: 'rq-1', requisitionNumber: 'REQ-1', statusCode: 'APPV', status: 'Approved', convertedPurchaseOrderId: PO_ID },
        { id: 'rq-x', requisitionNumber: 'REQ-X', statusCode: 'APPV', status: 'Approved', convertedPurchaseOrderId: 'other' },
      ],
    });
    mocks.forPurchaseOrder.mockResolvedValue([
      { id: 'ir-1', itemReceiptNumber: 'IRCT-1', statusCode: 'PEND', status: 'Pending' },
      { id: 'ir-2', itemReceiptNumber: 'IRCT-2', statusCode: 'PEND', status: 'Pending' },
    ]);
    mocks.searchVendorBills.mockResolvedValue({
      records: [
        { id: 'vb-1', vendorBillNumber: 'VB-1', statusCode: 'DRFT', status: 'Draft', purchaseOrder: { id: PO_ID, number: PO_NUMBER } },
        { id: 'vb-x', vendorBillNumber: 'VB-X', statusCode: 'DRFT', status: 'Draft', purchaseOrder: { id: 'other', number: 'PORD-9' } },
      ],
    });
    mocks.getPayments.mockResolvedValue({ payments: [], refunds: [], billPayments: [] });
  });

  it('finds every receipt and only the bills raised from this order', async () => {
    const { result } = renderHook(() => usePurchaseDerivedWorkflow({ purchaseOrderId: PO_ID }), { wrapper });
    await waitFor(() => expect(result.current.vendorBill).toBeDefined());
    expect(result.current.receiving).toHaveLength(2);
    expect(result.current.vendorBill).toEqual([{ id: 'vb-1', number: 'VB-1', statusCode: 'DRFT', status: 'Draft' }]);
    expect(mocks.searchVendorBills).toHaveBeenCalledWith(expect.objectContaining({ search: PO_NUMBER }));
  });

  it('finds the requisition that was converted into this order, even an old one', async () => {
    const { result } = renderHook(() => usePurchaseDerivedWorkflow({ purchaseOrderId: PO_ID }), { wrapper });
    await waitFor(() => expect(result.current.requisition).toBeDefined());
    expect(result.current.requisition).toEqual([{ id: 'rq-1', number: 'REQ-1', statusCode: 'APPV', status: 'Approved' }]);
  });
});
