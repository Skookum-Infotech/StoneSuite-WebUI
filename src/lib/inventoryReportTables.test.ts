import { describe, it, expect } from 'vitest';
import { formatMoney } from './formatMoney';
import {
  formatQty,
  formatSignedQty,
  formatSlabCell,
  lowStockReportTable,
  movementReportTable,
  slabReportTable,
  stockReportTable,
  valueByItem,
} from './inventoryReportTables';
import type { StockRow } from '@/types/reports';

const stock = (over: Partial<StockRow>): StockRow => ({
  itemId: 'i1', sku: 'S1', name: 'Granite', tracking: 'serialized', unit: 'SQFT', location: 'Main',
  onHand: 10, allocated: 4, available: 6, unitCost: 25, value: 250, ...over,
});

describe('quantity formatting', () => {
  it.each([
    [12.5, 'SQFT', '12.5 SQFT'],
    [3, '', '3'],
    [1234.567, 'EA', '1,234.57 EA'],
  ])('formatQty(%s, %s) -> %s', (q, unit, want) => {
    expect(formatQty(q, unit)).toBe(want);
  });

  it.each([
    [0, 'SQFT', '—'],
    [5.5, 'SQFT', '+5.5 SQFT'],
    [-3, 'SQFT', '-3 SQFT'],
  ])('formatSignedQty(%s) -> %s', (q, unit, want) => {
    expect(formatSignedQty(q, unit)).toBe(want);
  });

  it.each([
    [0, 0, '—'],
    [1, 8.333, '1 slab · 8.33 SQFT'],
    [10, 259.445, '10 slabs · 259.45 SQFT'],
  ])('formatSlabCell(%s, %s) -> %s', (count, area, want) => {
    expect(formatSlabCell(count, area, 'SQFT')).toBe(want);
  });
});

describe('valueByItem', () => {
  it('sums an item held at several locations and sorts by value', () => {
    const got = valueByItem([
      stock({ itemId: 'a', name: 'A', location: 'Main', value: 100 }),
      stock({ itemId: 'b', name: 'B', value: 500 }),
      stock({ itemId: 'a', name: 'A', location: 'Yard', value: 250 }),
    ]);
    expect(got).toEqual([{ name: 'B', value: 500 }, { name: 'A', value: 350 }]);
  });
});

describe('report tables', () => {
  it('stock table lines up with its headers and totals the value', () => {
    const t = stockReportTable({ totals: { value: 250, items: 1, locations: 1, rows: 1 }, rows: [stock({})] });
    expect(t.rows[0]).toHaveLength(t.headers.length);
    expect(t.totalsRow).toHaveLength(t.headers.length);
    expect(t.rows[0][7]).toBe(formatMoney(250));
  });

  it('slab table adds one column per status label', () => {
    const t = slabReportTable({
      labels: ['Available', 'Reserved'],
      totals: { counts: [3, 1], areas: [30, 10], totalSlabs: 4 },
      rows: [{ itemId: 'i', sku: 'S', name: 'Marble', unit: 'SQFT', counts: [3, 0], areas: [30, 0], totalSlabs: 3, totalArea: 30 }],
    });
    expect(t.headers).toEqual(['SKU', 'Material', 'Available', 'Reserved', 'Total']);
    expect(t.rows[0]).toEqual(['S', 'Marble', '3 slabs · 30 SQFT', '—', '3 slabs · 30 SQFT']);
    expect(t.totalsRow).toHaveLength(t.headers.length);
  });

  it('low stock table names the state in words', () => {
    const t = lowStockReportTable({
      totals: { rows: 2, outOfStock: 1, items: 2 },
      rows: [
        { itemId: 'a', sku: 'A', name: 'A', unit: 'EA', location: 'Main', onHand: 0, allocated: 0, available: 0, reorderPoint: 10, onOrder: 0, suggestedOrder: 10, state: 'out' },
        { itemId: 'b', sku: 'B', name: 'B', unit: 'EA', location: 'Main', onHand: 4, allocated: 1, available: 3, reorderPoint: 10, onOrder: 2, suggestedOrder: 4, state: 'below' },
      ],
    });
    expect(t.rows.map((r) => r[3])).toEqual(['Out of stock', 'Below reorder point']);
    expect(t.rows[1][8]).toBe('4 EA');
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });

  it('movement table signs each quantity', () => {
    const t = movementReportTable(
      {
        totals: { items: 1, movements: 3, growing: 0, shrinking: 1 },
        rows: [{ itemId: 'i', sku: 'S', name: 'Granite', unit: 'SQFT', received: 10, returned: 0, consumed: -14, scrapped: 0, adjusted: 0, net: -4, movements: 3 }],
      },
      { from: '2026-01-01', to: '2026-01-31' },
    );
    expect(t.rows[0].slice(2)).toEqual(['+10 SQFT', '—', '-14 SQFT', '—', '—', '-4 SQFT', '3']);
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });
});
