import { describe, it, expect } from 'vitest';
import {
  buildLineCardModel, buildOrderCardModel, lineName, summarizeReceipts,
  type OrderCardSource, type ReceiptDates,
} from './receivingCardModel';
import type { PurchaseOrderLine } from '@/types/purchaseOrder';

const TODAY = '2026-10-19';

function makeLine(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: 'l-1', lineNumber: 1, sku: 'SKU-1', itemName: 'Calacatta Slab', description: '', unitCode: '',
    quantity: 10, qtyReceived: 0, qtyBilled: 0, unitPrice: 5, discountPercent: 0, taxPercent: 0,
    lineSubtotal: 50, lineDiscount: 0, lineTax: 0, lineTotal: 50,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderCardSource> = {}): OrderCardSource {
  return {
    purchaseOrderNumber: 'PO-1001',
    statusCode: 'PART',
    vendor: { id: 'v-1', name: 'Marble Supply Co' },
    expectedDate: '2026-12-01',
    items: [],
    ...overrides,
  };
}

function receipt(overrides: Partial<ReceiptDates> = {}): ReceiptDates {
  return { receiptDate: '2026-10-10', postedAt: '2026-10-10T09:00:00Z', ...overrides };
}

describe('summarizeReceipts', () => {
  it('counts only posted, non-void receipts', () => {
    const got = summarizeReceipts([
      receipt({ receiptDate: '2026-10-02' }),
      receipt({ receiptDate: '2026-10-09' }),
      receipt({ receiptDate: '2026-10-15', postedAt: undefined }),
      receipt({ receiptDate: '2026-10-18', voidedAt: '2026-10-18T10:00:00Z' }),
    ]);
    expect(got).toEqual({ count: 2, lastReceivedOn: '2026-10-09' });
  });
  it('is empty with no receipts', () => {
    expect(summarizeReceipts([])).toEqual({ count: 0, lastReceivedOn: undefined });
  });
});

describe('lineName', () => {
  it.each([
    [{ itemName: 'Slab', description: 'd', sku: 's', lineNumber: 3 }, 'Slab'],
    [{ itemName: '', description: 'Free text', sku: 's', lineNumber: 3 }, 'Free text'],
    [{ itemName: '', description: '', sku: 'SKU-9', lineNumber: 3 }, 'SKU-9'],
    [{ itemName: '', description: '', sku: '', lineNumber: 3 }, 'Line 3'],
  ])('%j → %s', (line, want) => {
    expect(lineName(line)).toBe(want);
  });
});

describe('buildOrderCardModel', () => {
  const items = [
    makeLine({ id: 'a', itemName: 'Slab A', quantity: 10, qtyReceived: 10, qtyBilled: 10, unitCode: 'SQFT' }),
    makeLine({ id: 'b', itemName: 'Slab B', quantity: 10, qtyReceived: 5, qtyBilled: 0 }),
    makeLine({ id: 'c', itemName: 'Slab C', quantity: 10, qtyReceived: 0, qtyBilled: 0 }),
  ];

  it('summarises receiving across lines and receipts', () => {
    const model = buildOrderCardModel(makeOrder({ items }), [receipt(), receipt({ receiptDate: '2026-10-12' })], TODAY);
    expect(model.title).toBe('PO-1001 receiving');
    expect(model.subtitle).toBe('Marble Supply Co');
    expect(model.percent).toBe(50);
    expect(model.caption[0]).toBe('1 of 3 lines fully received');
    expect(model.caption[1]).toMatch(/^2 receipts · last received /);
    expect(model.overdue).toBeUndefined();
  });

  it('shows the lines-received and billed bars', () => {
    const model = buildOrderCardModel(makeOrder({ items }), [], TODAY);
    expect(model.rows).toEqual([
      { label: 'Lines received', percent: 33, valueLabel: '1 of 3' },
      { label: 'Billed', percent: 33 },
    ]);
  });

  it('lists every line with its own progress', () => {
    const model = buildOrderCardModel(makeOrder({ items }), [], TODAY);
    expect(model.breakdown.map((b) => [b.id, b.percent])).toEqual([['a', 100], ['b', 50], ['c', 0]]);
    expect(model.breakdown[1].detail).toBe('5 / 10');
  });

  it('says so when nothing has been posted', () => {
    const model = buildOrderCardModel(makeOrder({ items }), [receipt({ postedAt: undefined })], TODAY);
    expect(model.caption[1]).toBe('No receipts posted yet');
  });

  it('leaves the receipts line out while receipts are unknown', () => {
    const model = buildOrderCardModel(makeOrder({ items }), undefined, TODAY);
    expect(model.caption).toEqual(['1 of 3 lines fully received']);
  });

  it('flags late goods with the expected date', () => {
    const model = buildOrderCardModel(makeOrder({ items, expectedDate: '2026-10-01' }), [], TODAY);
    expect(model.overdue).toMatch(/^Overdue · expected /);
  });

  it('does not flag a fully received order as late', () => {
    const done = [makeLine({ quantity: 4, qtyReceived: 4 })];
    const model = buildOrderCardModel(makeOrder({ items: done, expectedDate: '2026-10-01' }), [], TODAY);
    expect(model.overdue).toBeUndefined();
  });

  it('copes with an order that has no lines', () => {
    const model = buildOrderCardModel(makeOrder(), [], TODAY);
    expect(model.percent).toBe(0);
    expect(model.caption).toEqual(['No lines with a quantity yet']);
    expect(model.rows[0]).toEqual({ label: 'Lines received', percent: 0, valueLabel: '0 of 0' });
  });

  it('leaves zero-quantity lines out of the breakdown', () => {
    const model = buildOrderCardModel(makeOrder({ items: [makeLine({ quantity: 0 }), makeLine({ id: 'x' })] }), [], TODAY);
    expect(model.breakdown.map((b) => b.id)).toEqual(['x']);
  });
});

describe('buildLineCardModel', () => {
  it('describes one line', () => {
    const model = buildLineCardModel(makeLine({ qtyReceived: 4, qtyBilled: 2, unitCode: 'SQFT' }));
    expect(model.title).toBe('Calacatta Slab');
    expect(model.subtitle).toBe('Line 1 · SKU-1');
    expect(model.percent).toBe(40);
    expect(model.caption[0]).toMatch(/^4 .* of 10 .* received$/);
    expect(model.caption[1]).toMatch(/^6 .* still to come$/);
    expect(model.rows).toEqual([{ label: 'Billed', percent: 20, valueLabel: '2 of 10' }]);
    expect(model.breakdown).toEqual([]);
  });

  it('reads Fully received once the line is complete', () => {
    expect(buildLineCardModel(makeLine({ qtyReceived: 10 })).caption[1]).toBe('Fully received');
  });

  it('adds slab progress for a slab line', () => {
    const model = buildLineCardModel(makeLine({ expectedSlabs: 12, slabsReceived: 11 }));
    expect(model.caption).toContain('11 of about 12 slabs');
  });

  it('omits the sku from the subtitle when there is none', () => {
    expect(buildLineCardModel(makeLine({ sku: '', lineNumber: 4 })).subtitle).toBe('Line 4');
  });
});
