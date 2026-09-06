import { describe, it, expect } from 'vitest';
import { formatMaterialArea, materialDetailLine, materialSwatchStyle } from './materialConsumption';
import type { MaterialConsumptionRow } from '@/types/dashboardData';

function makeRow(overrides: Partial<MaterialConsumptionRow> = {}): MaterialConsumptionRow {
  return {
    id: 'item-1', name: 'Carrara Marble 3cm', unitCode: 'SQFT', colorHex: '',
    netUsed: 30, consumedArea: 40, recoveredArea: 10, scrappedArea: 0, slabCount: 8,
    ...overrides,
  };
}

describe('formatMaterialArea', () => {
  it('formats a whole number with the unit code lowercased', () => {
    expect(formatMaterialArea(412, 'SQFT')).toBe('412 sqft');
  });

  it('trims a fractional value to one decimal place', () => {
    expect(formatMaterialArea(46.499999, 'SQFT')).toBe('46.5 sqft');
  });

  it('omits the unit suffix when unitCode is empty', () => {
    expect(formatMaterialArea(10, '')).toBe('10');
  });
});

describe('materialDetailLine', () => {
  it('pluralizes "slabs" for a count other than one', () => {
    expect(materialDetailLine(makeRow({ slabCount: 8, recoveredArea: 0 }))).toBe('8 slabs');
  });

  it('uses singular "slab" for exactly one', () => {
    expect(materialDetailLine(makeRow({ slabCount: 1, recoveredArea: 0 }))).toBe('1 slab');
  });

  it('appends the recovered amount when any remnants came back', () => {
    expect(materialDetailLine(makeRow({ slabCount: 8, recoveredArea: 46, unitCode: 'SQFT' }))).toBe(
      '8 slabs · 46 sqft recovered',
    );
  });

  it('omits scrapped area from the detail line even when present', () => {
    const line = materialDetailLine(makeRow({ scrappedArea: 12, recoveredArea: 0 }));
    expect(line).not.toContain('scrap');
  });
});

describe('materialSwatchStyle', () => {
  it('builds a gradient from a real color hex', () => {
    const style = materialSwatchStyle('#A1B2C3', 'item-1');
    expect(style.backgroundImage).toContain('#A1B2C3');
  });

  it('falls back to a deterministic stone gradient when no hex is set', () => {
    const a = materialSwatchStyle('', 'item-42');
    const b = materialSwatchStyle('', 'item-42');
    expect(a).toEqual(b);
    expect(a.backgroundImage).not.toBe('');
  });

  it('is not empty for two different ids without a hex', () => {
    const a = materialSwatchStyle('', 'item-1');
    const b = materialSwatchStyle('', 'item-2');
    expect(a.backgroundImage.length).toBeGreaterThan(0);
    expect(b.backgroundImage.length).toBeGreaterThan(0);
  });
});
