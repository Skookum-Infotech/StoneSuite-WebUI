import { describe, expect, it } from 'vitest';
import { toCreatePayload as quotePayload, fromQuote } from './quoteForm';
import { toCreatePayload as poPayload, fromPurchaseOrder } from './purchaseOrderForm';
import { itemDefaults, toItemPayload, fromItem } from './inventoryItemForm';
import type { Quote } from '@/types/quote';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type { InventoryItem } from '@/types/inventory';

// Each line carries the unit its length and width were measured in, so the
// numbers can never be re-read in a different one.
describe('a line keeps the unit its size was measured in', () => {
  const baseData: Record<string, unknown> = { customer_uuid: 'c1', quote_date: '2026-10-14' };
  const line = (over: Record<string, unknown>) => ({
    id: 'a', lineNo: 1, itemName: 'Calacatta', itemDescription: '', quantity: '100', unitPrice: '10',
    discount: '0', amount: '1000.00', total: '1000.00', inventoryItemUuid: 'inv-1', units: 'SQFT', ...over,
  });

  it('sends the unit with the size of a quote line', () => {
    const { items } = quotePayload(baseData, [line({ length: '120', width: '60', slabs: '2', dimensionUnit: 'in' })]);
    expect(items[0]).toMatchObject({ length: 120, width: 60, slabs: 2, dimensionUnit: 'in' });
  });

  it('reads a saved line back in its own unit and sends the same thing again', () => {
    const quote = {
      id: 'q1', quoteNumber: 'QUOT-1', status: 'Draft', quoteDate: '2026-10-14', billing: {}, shipping: {},
      customer: { id: 'c1', name: 'Acme' },
      items: [{
        id: 'l1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'CAL-1', itemName: 'Calacatta', description: '',
        unitCode: 'SQFT', quantity: 100, unitPrice: 10, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 1000, lineDiscount: 0, lineTax: 0, lineTotal: 1000,
        length: 120, width: 60, slabs: 2, dimensionUnit: 'in',
      }],
    } as unknown as Quote;

    const { lineItems } = fromQuote(quote);
    expect(lineItems[0]).toMatchObject({ length: '120', width: '60', slabs: '2', dimensionUnit: 'in' });
    expect(quotePayload(baseData, lineItems).items[0]).toMatchObject({ length: 120, width: 60, slabs: 2, dimensionUnit: 'in' });
  });

  it('sends no unit for a line without a size', () => {
    const { items } = quotePayload(baseData, [line({ dimensionUnit: 'in' })]);
    expect(items[0]).not.toHaveProperty('dimensionUnit');
  });

  it('carries the unit on a purchase order line too', () => {
    const po = {
      status: 'Draft', purchaseOrderNumber: 'PORD-1', orderDate: '2026-10-14', shipTo: {},
      items: [{
        id: 'l1', lineNumber: 1, sku: 'S', itemName: 'Slab', description: '', unitCode: 'SQFT',
        quantity: 100, qtyReceived: 0, qtyBilled: 0, unitPrice: 25, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 2500, lineDiscount: 0, lineTax: 0, lineTotal: 2500, inventoryItemId: 'inv-1',
        tracking: 'quantity', expectedSlabs: 2, length: 120, width: 60, dimensionUnit: 'in',
      }],
      vendor: { id: 'v1', name: 'Nero' },
    } as unknown as PurchaseOrder;

    const { lineItems } = fromPurchaseOrder(po);
    expect(lineItems[0]).toMatchObject({ length: '120', width: '60', dimensionUnit: 'in', expectedSlabs: '2' });
    const payload = poPayload({ vendor_uuid: 'v1', order_date: '2026-10-14' }, lineItems);
    expect(payload.items[0]).toMatchObject({ length: 120, width: 60, dimensionUnit: 'in', expectedSlabs: 2 });
  });
});

describe('the inventory item form', () => {
  const baseItem = {
    id: 'i1', sku: 'SKU', name: 'Slab', description: '', unitId: 6, unitPrice: 10, isActive: true,
    customFields: {}, tracking: 'quantity', thicknessMm: 30, barcode: '', createdAt: '', updatedAt: '',
  } as unknown as InventoryItem;

  it('starts a new item in inches', () => {
    expect(itemDefaults().dimension_unit).toBe('in');
  });

  it('sends the chosen unit with the whole-object write', () => {
    const payload = toItemPayload({ ...itemDefaults(), sku: 'S', name: 'N', unit_id: '6', dimension_unit: 'cm' });
    expect(payload.dimensionUnit).toBe('cm');
  });

  it('falls back to inches for a unit it does not know', () => {
    const payload = toItemPayload({ ...itemDefaults(), sku: 'S', name: 'N', unit_id: '6', dimension_unit: 'yd' });
    expect(payload.dimensionUnit).toBe('in');
  });

  it('loads an item\'s unit into the form, inches when the item has none', () => {
    expect(fromItem({ ...baseItem, dimensionUnit: 'ft' }).dimension_unit).toBe('ft');
    expect(fromItem(baseItem).dimension_unit).toBe('in');
  });
});
