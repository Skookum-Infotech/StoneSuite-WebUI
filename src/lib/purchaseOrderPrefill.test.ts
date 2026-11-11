import { describe, it, expect } from 'vitest';
import {
  purchaseOrderPrefillFrom,
  purchaseOrderPrefillLines,
  purchaseOrderPrefillState,
  shortageLine,
} from './purchaseOrderPrefill';
import type { InventoryItem } from '@/types/inventory';
import type { StockShortage } from '@/types/salesOrder';

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'item', sku: 'SKU', name: 'Item', description: '', unitId: 1, unitPrice: 10, isActive: true,
    customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '', ...over,
  };
}

// A 120 x 60 in slab, 3/4 in thick: 3048 x 1524 x 19.05 mm. One slab is 50 sq ft.
const SLAB = item({
  id: 'i-slab', sku: 'GRN', name: 'Granite', tracking: 'serialized', unitPrice: 40, purchaseUnitPrice: 25,
  dimensionUnit: 'in', lengthMm: 3048, widthMm: 1524, thicknessMm: 19.05,
});
const UNSIZED_SLAB = item({ id: 'i-raw', sku: 'MRB', name: 'Marble', tracking: 'serialized', dimensionUnit: 'in' });
const SINK = item({ id: 'i-sink', sku: 'SINK-9', name: 'Undermount Sink', unitPrice: 250, purchaseUnitPrice: 180 });

const short = (itemId: string, unitCode: string, qty: number): StockShortage => ({
  itemId, sku: '', name: '', unitCode, requested: qty, available: 0, short: qty,
});

describe('shortageLine', () => {
  it('orders a sized slab item in whole slabs of its own size, enough to cover the gap', () => {
    // 156.25 sq ft short / 50 sq ft a slab = 3.125 → 4 slabs = 200 sq ft.
    expect(shortageLine(short('i-slab', 'SQFT', 156.25), SLAB, 'SQFT')).toMatchObject({
      inventoryItemUuid: 'i-slab', itemName: 'Granite', itemSku: 'GRN', units: 'SQFT',
      length: '120', width: '60', thickness: '0.75', dimensionUnit: 'in',
      expectedSlabs: '4', quantity: '200', unitPrice: '25', amount: '5000.00',
    });
  });

  it('does not round an exact number of slabs up', () => {
    expect(shortageLine(short('i-slab', 'SQFT', 100.0000001), SLAB, 'SQFT')).toMatchObject({ expectedSlabs: '2', quantity: '100' });
  });

  it('orders a slab item with no standard size at exactly the shortfall', () => {
    expect(shortageLine(short('i-raw', 'SQFT', 312.5), UNSIZED_SLAB, 'SQFT')).toMatchObject({
      itemName: 'Marble', units: 'SQFT', length: '', width: '', quantity: '312.5',
    });
  });

  it('orders a counted item at exactly the shortfall, trimmed of float noise', () => {
    const line = shortageLine(short('i-sink', 'EA', 3.0000001), SINK, 'EA');
    expect(line).toMatchObject({ itemName: 'Undermount Sink', units: 'EA', quantity: '3', unitPrice: '180', amount: '540.00' });
    expect(line.length ?? '').toBe('');
  });

  it("falls back to the shortage's unit while the unit lookups are loading", () => {
    expect(shortageLine(short('i-slab', 'SQFT', 50), SLAB, '')).toMatchObject({ units: 'SQFT', expectedSlabs: '1', quantity: '50' });
  });
});

describe('purchaseOrderPrefillLines', () => {
  it('numbers one line per short item', () => {
    const lines = purchaseOrderPrefillLines([short('i-slab', 'SQFT', 50), short('i-sink', 'EA', 2)], [SLAB, SINK], (i) => (i.id === 'i-sink' ? 'EA' : 'SQFT'));
    expect(lines.map((l) => [l.lineNo, l.itemName, l.quantity])).toEqual([[1, 'Granite', '50'], [2, 'Undermount Sink', '2']]);
    expect(new Set(lines.map((l) => l.id)).size).toBe(2);
  });
});

describe('purchaseOrderPrefillFrom', () => {
  it('reads back the lines handed over in router state', () => {
    const lines = purchaseOrderPrefillLines([short('i-sink', 'EA', 2)], [SINK], () => 'EA');
    expect(purchaseOrderPrefillFrom(purchaseOrderPrefillState(lines))).toEqual(lines);
  });

  it.each([
    ['no state', null],
    ['unrelated state', { returned: true }],
    ['an empty list', { purchaseOrderPrefill: [] }],
    ['a malformed line', { purchaseOrderPrefill: [{ itemName: 'Granite' }] }],
  ])('ignores %s', (_name, state) => {
    expect(purchaseOrderPrefillFrom(state)).toBeNull();
  });
});
