import { describe, it, expect } from 'vitest';
import { buildVendorBillHandoff } from './vendorBillDocumentHandoff';
import { linkPoLines } from './vendorBillPoLink';
import { f, line, match } from '@/test/documentExtractionFixtures';
import { vendorDoc } from '@/test/purchaseDocFixtures';
import type { LinkedPurchaseOrder, LinkedPurchaseOrderLine } from '@/types/documentExtraction';

const poLine = (over: Partial<LinkedPurchaseOrderLine> = {}): LinkedPurchaseOrderLine => ({
  id: 'poi-1', lineNumber: 1, inventoryItemUuid: 'item-1', description: 'Quartz slab 3cm',
  qtyMilli: 10_000, billableQtyMilli: 10_000, unitPriceCents: 5000, ...over,
});
const po = (over: Partial<LinkedPurchaseOrder> = {}): LinkedPurchaseOrder => ({
  uuid: 'po-9', number: 'PO-1009', status: 'RCVD', billable: true, lines: [poLine()], ...over,
});
const bill = (over: Parameters<typeof vendorDoc>[0] = {}) => buildVendorBillHandoff(
  vendorDoc({ docType: 'vendor_bill', header: { invoiceNumber: f('INV-77'), invoiceDate: f('09/05/2026'), poNumber: f('PO-1009') }, ...over }),
  'bill.pdf',
);
const reasons = (h: ReturnType<typeof bill>, key: string): string[] => h.reviewItems.filter((i) => i.key === key).map((i) => i.reason);

describe('buildVendorBillHandoff header', () => {
  it('maps number, dates, terms and the PO reference onto the bill form', () => {
    const h = bill({ header: { invoiceNumber: f('INV-77'), invoiceDate: f('09/05/2026'), dueDate: f('10/05/2026'), poNumber: f('PO-1009') }, paymentTerms: { id: 2, name: 'Net 30', code: 'N30' } });
    expect(h.data).toMatchObject({
      vendor_invoice_number: 'INV-77', bill_date: '2026-09-05', due_date: '2026-10-05', payment_terms: '2', reference_number: 'PO-1009',
    });
    expect(h.vendor.resolved?.id).toBe('ven-1');
  });

  it.each([
    { name: 'a computed due date is flagged', header: { dueDate: f('2026-10-05', { confidence: 'check' }) }, warnings: ['due_date_from_terms'], expect: 'Computed from the payment terms' },
    { name: 'a due date before the bill date is flagged', header: { dueDate: f('2026-08-01') }, warnings: [], expect: 'before the bill date' },
    { name: 'a missing invoice number is flagged', header: { invoiceNumber: f() }, warnings: ['missing_invoice_number'], expect: 'No vendor invoice number' },
    { name: 'a missing invoice date is flagged', header: { invoiceDate: f() }, warnings: ['missing_invoice_date'], expect: 'No invoice date' },
  ])('$name', ({ header, warnings, expect: text }) => {
    const h = bill({ header: { invoiceNumber: f('INV-77'), invoiceDate: f('2026-09-05'), ...header }, extracted: { warnings } });
    const all = h.reviewItems.map((i) => i.reason).join(' | ');
    expect(all).toContain(text);
  });

  it('shows credit documents and customer-PO / wrong-type files as document warnings', () => {
    const credit = bill({ extracted: { warnings: ['credit_document'] } });
    expect(credit.reviewItems.find((i) => i.link)?.link?.to).toBe('/purchases/vendor_credit/new');
    const sales = bill({ extracted: { warnings: ['document_looks_like_sales_invoice'] } });
    expect(reasons(sales, 'document')[0]).toContain('sales invoice');
    expect(sales.badges.wrongType).toBe('sales invoice');
    expect(bill({ extracted: { warnings: ['document_not_recognized'] } }).badges.notRecognizedLabel).toBe('Not a vendor bill?');
  });

  it('folds freight into the adjustment and says so', () => {
    const h = bill({ header: { shipping: f('30.00'), discount: f('10.00') } });
    expect(h.data.adjustment).toBe('20.00');
    expect(reasons(h, 'adjustment').some((r) => r.includes('Freight'))).toBe(true);
  });
});

describe('buildVendorBillHandoff linked purchase order', () => {
  it('links a billable PO and each bill line to its single PO line', () => {
    const h = bill({ linkedPurchaseOrder: po() });
    expect(h.purchaseOrder.ref).toEqual({ id: 'po-9', number: 'PO-1009' });
    expect(h.lineItems[0].purchaseOrderItemId).toBe('poi-1');
    expect(h.provenance.purchaseOrder.value).toBe('PO-1009');
  });

  it('leaves the line unlinked and asks the reviewer to pick when two PO lines carry the same item', () => {
    const h = bill({ linkedPurchaseOrder: po({ lines: [poLine(), poLine({ id: 'poi-2', lineNumber: 2 })] }) });
    expect(h.lineItems[0].purchaseOrderItemId).toBeUndefined();
    expect(h.purchaseOrder.candidates[h.lineItems[0].id]).toEqual(['poi-1', 'poi-2']);
    expect(reasons(h, 'line:1').join(' ')).toContain('pick the PO line');
    expect(h.purchaseOrder.ref).not.toBeNull();
  });

  it('matches by description when the bill line has no catalog item', () => {
    const h = bill({
      matches: [],
      linkedPurchaseOrder: po({ lines: [poLine({ inventoryItemUuid: undefined, description: '  quartz SLAB 3cm ' })] }),
    });
    expect(h.lineItems[0].inventoryItemUuid).toBeUndefined();
    expect(h.lineItems[0].purchaseOrderItemId).toBe('poi-1');
  });

  it('does not link a line that is not on the PO, and flags billing more than is received', () => {
    const other = bill({ linkedPurchaseOrder: po({ lines: [poLine({ inventoryItemUuid: 'item-9' })] }), lines: [line()], matches: [match(0)] });
    expect(other.lineItems[0].purchaseOrderItemId).toBeUndefined();
    const over = bill({ linkedPurchaseOrder: po({ lines: [poLine({ billableQtyMilli: 4000 })] }) });
    expect(over.lineItems[0].purchaseOrderItemId).toBe('poi-1');
    expect(reasons(over, 'line:1').join(' ')).toContain('lower the quantity or unlink');
    expect(over.reviewItems.find((i) => i.key === 'line:1' && i.required)).toBeDefined();
  });

  it('keeps a PO that cannot be billed as a plain reference with the reason, linking no lines', () => {
    const h = bill({ linkedPurchaseOrder: po({ billable: false, status: 'SENT', reason: 'Nothing has been received on PO-1009 yet.', lines: [poLine()] }) });
    expect(h.purchaseOrder.ref).toEqual({ id: 'po-9', number: 'PO-1009' });
    expect(h.lineItems[0].purchaseOrderItemId).toBeUndefined();
    expect(reasons(h, 'purchaseOrder')[0]).toContain('Nothing has been received');
  });

  it.each([
    { name: 'another vendor / blanked by the server', lpo: { billable: false, reason: "PO-1009 belongs to another vendor.", lines: [] } as LinkedPurchaseOrder, vendor: undefined },
    { name: 'a PO that was not found', lpo: undefined, vendor: undefined },
    { name: 'an unresolved vendor', lpo: po(), vendor: null },
  ])('sets no link for $name and says why', ({ lpo, vendor }) => {
    const h = bill({ linkedPurchaseOrder: lpo, ...(vendor === null ? { vendor: null } : {}) });
    expect(h.purchaseOrder.ref).toBeNull();
    expect(h.lineItems[0].purchaseOrderItemId).toBeUndefined();
    expect(reasons(h, 'purchaseOrder').length).toBe(1);
  });
});

describe('linkPoLines', () => {
  it('says a second line billing an already-taken PO line is a pick, not an ambiguity', () => {
    const fields = [1, 2].map((n) => ({ id: `l${n}`, lineNo: n, inventoryItemUuid: 'item-1', itemName: 'Slab', itemDescription: '', quantity: '1' }));
    const out = linkPoLines(fields as never, [{ id: 'poi-1', lineNumber: 1, inventoryItemUuid: 'item-1', description: 'Slab', qtyMilli: 5000, billableQtyMilli: 5000, unitPriceCents: 100 }]);
    expect(out.links).toEqual({ l1: 'poi-1' });
    expect(out.candidates).toEqual({ l2: ['poi-1'] });
    expect(out.items[0].reason).toContain('Another line already bills');
  });
});
