import { describe, it, expect } from 'vitest';
import { toCreatePayload as estimatePayload } from './estimateForm';
import { toCreatePayload as quotePayload } from './quoteForm';
import { toCreatePayload as orderPayload } from './salesOrderForm';
import { toCreatePayload as invoicePayload } from './invoiceForm';

// A slab line, 120 x 60 in, 3/4 in thick, and a piece-priced line that somehow
// still holds a thickness (a stale value must not be sent).
const BASE_LINE = {
  id: 'a', lineNo: 1, itemName: 'Item', itemDescription: '', itemSku: 'SKU-1', quantity: '1', unitPrice: '10', discount: '0',
  amount: '10.00', total: '10.00', tax: '0', inventoryItemUuid: 'inv-1', dimensionUnit: 'in',
};
const SLAB_LINE = { ...BASE_LINE, units: 'SQFT', length: '120', width: '60', thickness: '0.75' };
const PIECE_LINE = { ...BASE_LINE, units: 'EA', thickness: '0.75' };
const DATA = { customer_uuid: 'cust-1', ship_same_as_bill: true };

const BUILDERS: Array<[string, (line: typeof SLAB_LINE) => { thickness?: number; length?: number; dimensionUnit?: string }]> = [
  ['estimate', (l) => estimatePayload(DATA, [l]).items[0]],
  ['quote', (l) => quotePayload(DATA, [l]).items[0]],
  ['sales order', (l) => orderPayload(DATA, [l]).items[0]],
  ['invoice', (l) => invoicePayload(DATA, [l]).items[0]],
];

describe.each(BUILDERS)('%s payload — slab thickness', (_name, lineOf) => {
  it('sends the thickness with the size it is measured in', () => {
    const line = lineOf(SLAB_LINE);
    expect(line.thickness).toBe(0.75);
    expect(line.length).toBe(120);
    expect(line.dimensionUnit).toBe('in');
  });

  it('sends no thickness on a line that is not measured in an area unit', () => {
    expect(lineOf(PIECE_LINE as typeof SLAB_LINE).thickness).toBeUndefined();
  });

  it('sends no thickness when none is stated', () => {
    expect(lineOf({ ...SLAB_LINE, thickness: '' }).thickness).toBeUndefined();
  });
});
