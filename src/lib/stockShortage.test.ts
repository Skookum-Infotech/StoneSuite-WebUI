import { describe, it, expect } from 'vitest';
import {
  formatStockQty, itemsShortLabel, onOrderSentence, onOrderShortages, shortItemsSentence, shortageToastMessage, uncoveredShortages,
} from './stockShortage';
import type { StockShortage } from '@/types/salesOrder';

const GRN: StockShortage = {
  itemId: 'item-1', sku: 'GRN', name: 'Granite', unitCode: 'SQFT', requested: 156.25, available: 0, short: 156.25,
};
const MRB: StockShortage = {
  itemId: 'item-2', sku: 'MRB', name: 'Marble', unitCode: 'SQFT', requested: 312.5, available: 0, short: 312.5,
};
const SINK: StockShortage = {
  itemId: 'item-3', sku: '', name: 'Undermount Sink', unitCode: 'EA', requested: 3, available: 1, short: 2,
};

// Covered in full by a sent PO, and partly covered by two.
const ON_ORDER: StockShortage = {
  itemId: 'item-4', sku: 'QTZ', name: 'Quartz', unitCode: 'SQFT', requested: 100, available: 0, onOrder: 100, short: 0,
  purchaseOrders: ['PORD-000012'],
};
const PART: StockShortage = {
  itemId: 'item-5', sku: 'ONX', name: 'Onyx', unitCode: 'SQFT', requested: 80, available: 10, onOrder: 50, short: 20,
  purchaseOrders: ['PORD-000012', 'PORD-000014'],
};

describe('uncoveredShortages / onOrderShortages', () => {
  it('splits what nothing covers from what a sent PO is bringing', () => {
    expect(uncoveredShortages([GRN, ON_ORDER, PART])).toEqual([GRN, PART]);
    expect(onOrderShortages([GRN, ON_ORDER, PART])).toEqual([ON_ORDER, PART]);
  });
});

describe('onOrderSentence', () => {
  it.each([
    [[ON_ORDER], 'QTZ (100 sq ft on PORD-000012)'],
    [[ON_ORDER, PART], 'QTZ (100 sq ft on PORD-000012) and ONX (50 sq ft on PORD-000012 and PORD-000014)'],
    [[{ ...ON_ORDER, purchaseOrders: null }], 'QTZ (100 sq ft on order)'],
  ])('%#', (list, want) => {
    expect(onOrderSentence(list)).toBe(want);
  });
});

describe('formatStockQty', () => {
  it.each([
    [45.208, 'SQFT', '45.208 sq ft'],
    [12, 'EA', '12 each'],
    [12, 'SQM', '12 sq m'],
    [1234.5, 'SQFT', '1,234.5 sq ft'],
    [0.0004, 'SQFT', '0 sq ft'],
    [7, undefined, '7'],
    [7, '', '7'],
  ])('%s %s → %s', (value, code, want) => {
    expect(formatStockQty(value, code)).toBe(want);
  });
});

describe('itemsShortLabel', () => {
  it.each([
    [[GRN], '1 item short'],
    [[GRN, MRB], '2 items short'],
  ])('%#', (list, want) => {
    expect(itemsShortLabel(list)).toBe(want);
  });
});

describe('shortItemsSentence', () => {
  it.each([
    [[GRN], 'GRN (short 156.25 sq ft)'],
    [[GRN, MRB], 'GRN (short 156.25 sq ft) and MRB (short 312.5 sq ft)'],
    [[GRN, MRB, SINK], 'GRN (short 156.25 sq ft), MRB (short 312.5 sq ft) and Undermount Sink (short 2 each)'],
  ])('%#', (list, want) => {
    expect(shortItemsSentence(list)).toBe(want);
  });
});

describe('shortageToastMessage', () => {
  it('names the order and how many items are short', () => {
    expect(shortageToastMessage('SO-1042', 'created', [GRN, MRB])).toBe('SO-1042 created. 2 items short in inventory.');
  });

  it('falls back to "Sales order" when the number is not known', () => {
    expect(shortageToastMessage('', 'saved', [GRN])).toBe('Sales order saved. 1 item short in inventory.');
  });
});
