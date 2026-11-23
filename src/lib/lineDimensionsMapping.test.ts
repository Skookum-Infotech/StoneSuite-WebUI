import { describe, expect, it } from 'vitest';
import { toCreatePayload as quotePayload, fromQuote, fromSourceEstimate } from './quoteForm';
import { toCreatePayload as poPayload, fromPurchaseOrder } from './purchaseOrderForm';
import { toCreatePayload as billPayload, fromVendorBill } from './vendorBillForm';
import { toCreatePayload as reqnPayload, fromRequisition } from './requisitionForm';
import type { Quote } from '@/types/quote';
import type { Estimate } from '@/types/estimate';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type { VendorBill } from '@/types/vendorBill';
import type { Requisition } from '@/types/requisition';

// 304.8 x 152.4 cm is exactly 10 ft x 5 ft = 50 sq ft.
const SIZE = { length: '304.8', width: '152.4' };

describe('quote lines — slab size and count', () => {
  const baseData: Record<string, unknown> = { customer_uuid: 'c1', quote_date: '2026-10-13' };
  const line = (over: Record<string, unknown>) => ({
    id: 'a', lineNo: 1, itemName: 'Calacatta', itemDescription: '', quantity: '150', unitPrice: '10',
    discount: '0', amount: '1500.00', total: '1500.00', inventoryItemUuid: 'inv-1', units: 'SQFT', ...over,
  });

  it('sends the size and slab count of a sized line', () => {
    const { items } = quotePayload(baseData, [line({ ...SIZE, slabs: '3' })]);
    expect(items[0]).toMatchObject({ length: 304.8, width: 152.4, slabs: 3, quantity: 150 });
  });

  it('sends a bare line unchanged', () => {
    const { items } = quotePayload(baseData, [line({})]);
    expect(items[0]).not.toHaveProperty('length');
    expect(items[0]).not.toHaveProperty('slabs');
  });

  it('sends no size for a line that was switched to a per-piece item', () => {
    const { items } = quotePayload(baseData, [line({ ...SIZE, slabs: '3', units: 'EA' })]);
    expect(items[0]).not.toHaveProperty('length');
    expect(items[0]).not.toHaveProperty('slabs');
  });

  it('reads a saved line back and sends the same thing again', () => {
    const quote = {
      id: 'q1', quoteNumber: 'QUOT-1', status: 'Draft', quoteDate: '2026-10-13', billing: {}, shipping: {},
      customer: { id: 'c1', name: 'Acme' },
      items: [{
        id: 'l1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'CAL-1', itemName: 'Calacatta', description: '',
        unitCode: 'SQFT', quantity: 150, unitPrice: 10, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 1500, lineDiscount: 0, lineTax: 0, lineTotal: 1500,
        length: 304.8, width: 152.4, slabs: 3,
      }],
    } as unknown as Quote

    const { lineItems } = fromQuote(quote);
    expect(lineItems[0]).toMatchObject({ length: '304.8', width: '152.4', slabs: '3' });
    expect(quotePayload(baseData, lineItems).items[0]).toMatchObject({ length: 304.8, width: 152.4, slabs: 3 });
  });

  it('leaves the size blank on a saved line that never had one', () => {
    const quote = {
      id: 'q1', quoteNumber: 'QUOT-1', status: 'Draft', quoteDate: '2026-10-13', billing: {}, shipping: {},
      customer: { id: 'c1', name: 'Acme' },
      items: [{
        id: 'l1', lineNumber: 1, sku: 'S', itemName: 'Sealer', description: '', unitCode: 'EA', quantity: 2,
        unitPrice: 5, discountPercent: 0, taxPercent: 0, lineSubtotal: 10, lineDiscount: 0, lineTax: 0, lineTotal: 10,
      }],
    } as unknown as Quote

    expect(fromQuote(quote).lineItems[0]).toMatchObject({ length: '', width: '', slabs: '' });
  });

  it('carries the size from a source estimate into the prefilled quote', () => {
    const estimate = {
      id: 'e1', estimateNumber: 'EST-1', customer: { id: 'c1', name: 'Acme' }, salesTaxPercent: 0,
      items: [{
        id: 'l1', lineNumber: 1, sku: 'CAL-1', itemName: 'Calacatta', description: '', unitCode: 'SQFT',
        quantity: 100, unitPrice: 10, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 1000, lineDiscount: 0, lineTax: 0, lineTotal: 1000,
        length: 304.8, width: 152.4, slabs: 2,
      }],
    } as unknown as Estimate

    expect(fromSourceEstimate(estimate).lineItems[0]).toMatchObject({ length: '304.8', width: '152.4', slabs: '2' });
  });
});

describe('purchase order lines — the slab count is the expected slabs', () => {
  const baseData: Record<string, unknown> = { vendor_uuid: 'v1', order_date: '2026-10-13' };
  const line = (over: Record<string, unknown>) => ({
    id: 'a', lineNo: 1, itemName: 'Slab', itemDescription: '', quantity: '200', unitPrice: '25',
    discount: '0', amount: '5000.00', total: '5000.00', inventoryItemUuid: 'inv-1', units: 'SQFT', ...over,
  });

  it('sends the size, and the slab count as expectedSlabs, for a sized line of any area item', () => {
    // tracking "quantity": a bought-by-area item that is not slab-tracked.
    const { items } = poPayload(baseData, [line({ ...SIZE, tracking: 'quantity', expectedSlabs: '4' })]);
    expect(items[0]).toMatchObject({ length: 304.8, width: 152.4, expectedSlabs: 4, quantity: 200 });
    expect(items[0]).not.toHaveProperty('slabs');
  });

  it('still refuses a count on a per-piece item', () => {
    const { items } = poPayload(baseData, [line({ units: 'EA', tracking: 'quantity', expectedSlabs: '4', ...SIZE })]);
    expect(items[0].expectedSlabs).toBeUndefined();
    expect(items[0].length).toBeUndefined();
  });

  it('reads the size back with the count', () => {
    const po = {
      status: 'Draft', purchaseOrderNumber: 'PORD-1', orderDate: '2026-10-13', shipTo: {},
      items: [{
        id: 'l1', lineNumber: 1, sku: 'S', itemName: 'Slab', description: '', unitCode: 'SQFT',
        quantity: 200, qtyReceived: 0, qtyBilled: 0, unitPrice: 25, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 5000, lineDiscount: 0, lineTax: 0, lineTotal: 5000, inventoryItemId: 'inv-1',
        tracking: 'quantity', expectedSlabs: 4, length: 304.8, width: 152.4,
      }],
      vendor: { id: 'v1', name: 'Nero' },
    } as unknown as PurchaseOrder

    const { lineItems } = fromPurchaseOrder(po);
    expect(lineItems[0]).toMatchObject({ length: '304.8', width: '152.4', expectedSlabs: '4' });
    expect(poPayload(baseData, lineItems).items[0]).toMatchObject({ length: 304.8, width: 152.4, expectedSlabs: 4 });
  });
});

describe('vendor bill and requisition lines', () => {
  it('round-trips a sized vendor bill line', () => {
    const bill = {
      status: 'Draft', billNumber: 'VB-1', billDate: '2026-10-13', vendor: { id: 'v1', name: 'Nero' },
      items: [{
        id: 'l1', lineNumber: 1, sku: 'S', itemName: 'Slab', description: '', unitCode: 'SQFT', quantity: 100,
        unitPrice: 25, discountPercent: 0, taxPercent: 0, lineSubtotal: 2500, lineDiscount: 0, lineTax: 0,
        lineTotal: 2500, inventoryItemId: 'inv-1', length: 304.8, width: 152.4, slabs: 2,
      }],
    } as unknown as VendorBill

    const { lineItems } = fromVendorBill(bill);
    expect(lineItems[0]).toMatchObject({ length: '304.8', width: '152.4', slabs: '2' });
    const payload = billPayload({ vendor_uuid: 'v1', bill_date: '2026-10-13' }, lineItems);
    expect(payload.items[0]).toMatchObject({ length: 304.8, width: 152.4, slabs: 2, quantity: 100 });
  });

  it('round-trips a sized requisition line', () => {
    const reqn = {
      status: 'Draft', requisitionNumber: 'REQN-1', neededByDate: '2026-11-01', priority: 'normal',
      items: [{
        id: 'l1', lineNumber: 1, sku: 'S', itemName: 'Slab', description: '', unitCode: 'SQM', quantity: 9,
        estimatedUnitPrice: 40, estimatedAmount: 360, inventoryItemId: 'inv-1',
        length: 300, width: 150, slabs: 2,
      }],
    } as unknown as Requisition

    const { lineItems } = fromRequisition(reqn);
    expect(lineItems[0]).toMatchObject({ length: '300', width: '150', slabs: '2' });
    const payload = reqnPayload({ requested_by: '1', priority: 'Normal' }, lineItems);
    expect(payload.items[0]).toMatchObject({ length: 300, width: 150, slabs: 2, quantity: 9 });
  });
});
