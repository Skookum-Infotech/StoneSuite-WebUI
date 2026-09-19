import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/store/useAuthStore', () => ({ isPortalSession: vi.fn().mockReturnValue(false) }));

import { tenantClient } from '@/api/tenantClient';
import { estimateService } from './estimateService';
import { quoteService } from './quoteService';
import { salesOrderService } from './salesOrderService';
import { invoiceService } from './invoiceService';
import { purchaseOrderService } from './purchaseOrderService';
import { requisitionService } from './requisitionService';
import { vendorBillService } from './vendorBillService';
import { vendorPaymentService } from './vendorPaymentService';
import { paymentService } from './paymentService';
import { creditMemoService } from './creditMemoService';
import { refundService } from './refundService';
import { vendorCreditService } from './vendorCreditService';

interface Rejectable {
  id: string;
  canReject?: boolean;
  rejection?: { reason: string };
}

interface RejectableService {
  reject: (uuid: string, reason: string) => Promise<Rejectable>;
  [getter: string]: (uuid: string, ...rest: string[]) => Promise<Rejectable>;
}

// Every Sales/Purchases module that lets an approver reject: its service, its
// route, the key its record sits under in a response, and its detail getter.
const MODULES: [string, RejectableService, string, string, string][] = [
  ['estimate', estimateService as unknown as RejectableService, '/tenant/estimates', 'estimate', 'getEstimate'],
  ['quote', quoteService as unknown as RejectableService, '/tenant/quotes', 'quote', 'getQuote'],
  ['sales order', salesOrderService as unknown as RejectableService, '/tenant/sales-orders', 'salesOrder', 'getOrder'],
  ['invoice', invoiceService as unknown as RejectableService, '/tenant/invoices', 'invoice', 'getInvoice'],
  ['purchase order', purchaseOrderService as unknown as RejectableService, '/tenant/purchase-orders', 'purchaseOrder', 'getPurchaseOrder'],
  ['requisition', requisitionService as unknown as RejectableService, '/tenant/requisitions', 'requisition', 'getRequisition'],
  ['vendor bill', vendorBillService as unknown as RejectableService, '/tenant/vendor-bills', 'vendorBill', 'getVendorBill'],
  ['vendor payment', vendorPaymentService as unknown as RejectableService, '/tenant/vendor-payments', 'vendorPayment', 'getVendorPayment'],
  ['payment', paymentService as unknown as RejectableService, '/tenant/payments', 'payment', 'getPayment'],
  ['credit memo', creditMemoService as unknown as RejectableService, '/tenant/credit-memos', 'creditMemo', 'getCreditMemo'],
  ['refund', refundService as unknown as RejectableService, '/tenant/refunds', 'refund', 'getRefund'],
  ['vendor credit', vendorCreditService as unknown as RejectableService, '/tenant/vendor-credits', 'vendorCredit', 'getVendorCredit'],
];

describe('reject() on every Sales/Purchases service', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(MODULES)('%s: posts the reason to /reject and returns the record', async (_name, service, base, key) => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, [key]: { id: 'rec-1' } } });

    const updated = await service.reject('rec-1', 'Wrong vendor');

    expect(tenantClient.post).toHaveBeenCalledWith(`${base}/rec-1/reject`, { reason: 'Wrong vendor' });
    expect(updated).toEqual({ id: 'rec-1' });
  });
});

describe('the approval overlay on every Sales/Purchases detail getter', () => {
  beforeEach(() => vi.clearAllMocks());

  const rejection = { byName: 'Alice', reason: 'Wrong vendor', at: '2026-09-19T10:00:00Z' };

  it.each(MODULES)('%s: exposes canReject and the rejection', async (_name, service, base, key, getter) => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, [key]: { id: 'rec-1' }, approval: { gated: true, canReject: true, rejection } },
    });

    const loaded = await service[getter]('rec-1');

    expect(tenantClient.get).toHaveBeenCalledWith(`${base}/rec-1`);
    expect(loaded.canReject).toBe(true);
    expect(loaded.rejection).toEqual(rejection);
  });

  it.each(MODULES)('%s: defaults to no reject and no rejection when the server sends none', async (_name, service, _base, key, getter) => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, [key]: { id: 'rec-1' } } });

    const loaded = await service[getter]('rec-1');

    expect(loaded.canReject).toBe(false);
    expect(loaded.rejection).toBeUndefined();
  });
});
