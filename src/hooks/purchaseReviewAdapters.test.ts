import { describe, it, expect, vi } from 'vitest';
import { createPurchaseOrderAdapter } from './purchaseOrderReviewAdapter';
import { createVendorBillAdapter } from './vendorBillReviewAdapter';
import { buildPurchaseOrderHandoff } from '@/lib/purchaseOrderDocumentHandoff';
import { buildVendorBillHandoff } from '@/lib/vendorBillDocumentHandoff';
import { f } from '@/test/documentExtractionFixtures';
import { vendorDoc } from '@/test/purchaseDocFixtures';
import type { PurchaseOrderReviewForm, VendorBillReviewForm } from './purchaseReviewTypes';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type { VendorBill } from '@/types/vendorBill';

const GEO = { countries: [], states: [] };

describe('Purchase Order adapter', () => {
  const onVendorChange = vi.fn();
  const adapter = createPurchaseOrderAdapter({ geo: GEO, onVendorChange });
  const doc = vendorDoc({ header: { poNumber: f('Q-778'), vendorName: f('Marble Supply') } });
  const handoff = buildPurchaseOrderHandoff(doc, 'q.pdf', GEO);
  const form = (over: Partial<PurchaseOrderReviewForm> = {}): PurchaseOrderReviewForm => ({
    data: { ...handoff.data, shipping_charge: '25', adjustment: '-5' }, lineItems: handoff.lineItems, vendor: null, customFieldValues: {}, ...over,
  });

  it('waits for the geo lookups before building a handoff', () => {
    const waiting = createPurchaseOrderAdapter({ geo: undefined, onVendorChange });
    expect(waiting.buildHandoff(doc, 'q.pdf')).toBeNull();
    expect(adapter.buildHandoff(doc, 'q.pdf')).not.toBeNull();
  });

  it('prefills data, lines and the resolved vendor', () => {
    expect(adapter.prefill(handoff)).toEqual({ data: handoff.data, lineItems: handoff.lineItems, vendor: { id: 'ven-1', name: 'Marble Supply Co' } });
  });

  it('counts the form-held shipping and adjustment in the pre-tax total', () => {
    expect(adapter.extrasAmount({}, form())).toBe(20);
  });

  it('applyParty only sets the vendor (no document value is touched)', () => {
    adapter.applyParty({ id: 'v9', name: 'Other' }, handoff);
    expect(onVendorChange).toHaveBeenCalledWith({ id: 'v9', name: 'Other' });
  });

  it('completes with the vendor, reference number, order date and learned lines', () => {
    const input = adapter.completeInput({ id: 'po-1' } as PurchaseOrder, form({ vendor: { id: 'ven-1', name: 'M' }, lineItems: handoff.lineItems }), handoff);
    expect(input).toMatchObject({ recordUuid: 'po-1', saved: { vendorUuid: 'ven-1', poNumber: 'Q-778' } });
    expect(input.saved.lines).toEqual([{ docSku: 'QZ-3CM', docDescription: 'Quartz slab 3cm', itemUuid: 'item-1' }]);
  });

  it('notes the learned vendor alias only when the reviewer chose another vendor', () => {
    const base = form({ vendor: { id: 'ven-1', name: 'Marble Supply Co' } });
    const po = { id: 'po-1', purchaseOrderNumber: 'PO-9' } as PurchaseOrder;
    expect(adapter.createdSummary(po, base, handoff, 'q.pdf')).toMatchObject({ title: 'Purchase Order PO-9 created from q.pdf', description: undefined });
    const other = adapter.createdSummary(po, form({ vendor: { id: 'v9', name: 'Other Co' } }), handoff, 'q.pdf');
    expect(other.description).toBe("We'll remember Marble Supply → Other Co next time.");
  });
});

describe('Vendor Bill adapter', () => {
  const onVendorChange = vi.fn();
  const adapter = createVendorBillAdapter({ onVendorChange });
  const handoff = buildVendorBillHandoff(vendorDoc({
    docType: 'vendor_bill', header: { invoiceNumber: f('INV-77'), invoiceDate: f('2026-09-05') },
  }), 'b.pdf');
  const form: VendorBillReviewForm = {
    data: { ...handoff.data, adjustment: '12.5', vendor_invoice_number: 'INV-77', bill_date: '2026-09-05' },
    lineItems: handoff.lineItems, vendor: { id: 'ven-1', name: 'M' }, purchaseOrder: { id: 'po-9', number: 'PO-1009' }, customFieldValues: {},
  };

  it.each([
    { allow: false, expected: {} },
    { allow: true, expected: { allowDuplicate: true } },
  ])('payload extras with allowDuplicate=$allow', ({ allow, expected }) => {
    expect(adapter.payloadExtras({}, allow)).toEqual(expected);
  });

  it('counts the adjustment in the pre-tax total', () => {
    expect(adapter.extrasAmount({}, form)).toBe(12.5);
  });

  it('completes with vendor, invoice number/date and the referenced PO number', () => {
    const input = adapter.completeInput({ id: 'vb-1' } as VendorBill, form, handoff);
    expect(input.saved).toMatchObject({ vendorUuid: 'ven-1', invoiceNumber: 'INV-77', invoiceDate: '2026-09-05', poNumber: 'PO-1009' });
  });

  it('keeps the draft\'s PO link when restoring and fills only an empty vendor', () => {
    const draft = { ...form, vendor: null, purchaseOrder: { id: 'po-3', number: 'PO-3' } };
    const merged = adapter.mergeDraft(draft, handoff);
    expect(merged.vendor).toEqual({ id: 'ven-1', name: 'Marble Supply Co' });
    expect(merged.purchaseOrder).toEqual({ id: 'po-3', number: 'PO-3' });
  });

  it('does not refill a line the reviewer edited', () => {
    const draft = { ...form, lineItems: handoff.lineItems.map((l) => ({ ...l, inventoryItemUuid: undefined, quantity: '99' })) };
    expect(adapter.mergeDraft(draft, handoff).lineItems[0].inventoryItemUuid).toBeUndefined();
  });
});
