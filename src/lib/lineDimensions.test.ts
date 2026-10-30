import { describe, expect, it } from 'vitest';
import {
  anyDimensions, clampDimension, clampDimensionField, clampSlabs, dimensionCells, dimensionsFromLine, dimensionsPayload,
  dimensionToMm, hasSize, mmToDimension, isAreaUnit, isSized, itemDimensionUnit, maxDimension, normalizeUnit, sanitizeDimensionInput, sizedQuantity,
  sizeSummary, stepDimension, withoutUnsupportedSize, withSizedQuantity,
} from './lineDimensions';

// 304.8 x 152.4 cm is exactly 10 ft x 5 ft = 50 sq ft.
const TEN_BY_FIVE_FEET = { length: '304.8', width: '152.4', dimensionUnit: 'cm' };

describe('isAreaUnit', () => {
  it.each([
    ['SQFT', true], ['sqft', true], [' SQM ', true],
    ['EA', false], ['SLAB', false], ['LFT', false], ['', false], [undefined, false],
  ])('%j -> %s', (unit, want) => {
    expect(isAreaUnit(unit)).toBe(want);
  });
});

describe('normalizeUnit / itemDimensionUnit', () => {
  it.each([
    ['mm', 'mm'], ['CM', 'cm'], [' In ', 'in'], ['ft', 'ft'], ['m', 'm'],
    // Inches are the default: blank and unknown both read as inches.
    ['', 'in'], [undefined, 'in'], [null, 'in'], ['yd', 'in'], ['inch', 'in'],
  ])('%j -> %s', (raw, want) => {
    expect(normalizeUnit(raw)).toBe(want);
  });

  it('reads a catalog item\'s unit, inches when it has none', () => {
    expect(itemDimensionUnit({ dimensionUnit: 'cm' })).toBe('cm');
    expect(itemDimensionUnit({ dimensionUnit: 'ft' })).toBe('ft');
    expect(itemDimensionUnit({})).toBe('in');
  });
});

describe('sizedQuantity', () => {
  it.each<[string, { length?: string; width?: string; slabs?: string; dimensionUnit?: string }, string | undefined, string]>([
    ['one slab in sqft', { ...TEN_BY_FIVE_FEET, slabs: '1' }, 'SQFT', '50'],
    ['three slabs', { ...TEN_BY_FIVE_FEET, slabs: '3' }, 'SQFT', '150'],
    ['blank slabs counts as one', { ...TEN_BY_FIVE_FEET }, 'SQFT', '50'],
    ['zero slabs counts as one', { ...TEN_BY_FIVE_FEET, slabs: '0' }, 'SQFT', '50'],
    ['square metres', { length: '300', width: '150', slabs: '2', dimensionUnit: 'cm' }, 'SQM', '9'],
    ['rounds the area to three decimals', { length: '300', width: '150', slabs: '1', dimensionUnit: 'cm' }, 'SQFT', '48.438'],
    ['rounds dimensions to two decimals first', { length: '30.484', width: '30.48', dimensionUnit: 'cm' }, 'SQFT', '1'],
    ['a non-area unit', { ...TEN_BY_FIVE_FEET, slabs: '2' }, 'EA', ''],
    ['no unit', { ...TEN_BY_FIVE_FEET }, undefined, ''],
    ['length only', { length: '300' }, 'SQFT', ''],
    ['width only', { width: '150', slabs: '3' }, 'SQFT', ''],
    ['text in a dimension', { length: 'abc', width: '150' }, 'SQFT', ''],
    ['negative length', { length: '-5', width: '150' }, 'SQFT', ''],
    ['area too small to price', { length: '0.01', width: '0.01' }, 'SQFT', ''],
  ])('%s', (_name, dims, unit, want) => {
    expect(sizedQuantity(dims, unit)).toBe(want);
  });

  // The same 50 sq ft slab, measured every way.
  it.each([
    ['inches', { length: '120', width: '60', dimensionUnit: 'in' }, 'SQFT', '50'],
    ['no unit stated reads as inches', { length: '120', width: '60' }, 'SQFT', '50'],
    ['an unknown unit reads as inches', { length: '120', width: '60', dimensionUnit: 'yd' }, 'SQFT', '50'],
    ['feet', { length: '10', width: '5', dimensionUnit: 'ft' }, 'SQFT', '50'],
    ['millimetres', { length: '3048', width: '1524', dimensionUnit: 'mm' }, 'SQFT', '50'],
    ['centimetres', { length: '304.8', width: '152.4', dimensionUnit: 'cm' }, 'SQFT', '50'],
    ['two inch slabs', { length: '120', width: '60', slabs: '2', dimensionUnit: 'in' }, 'SQFT', '100'],
    ['metres into square metres', { length: '3', width: '1.5', dimensionUnit: 'm' }, 'SQM', '4.5'],
    ['metres into square feet', { length: '3', width: '1.5', dimensionUnit: 'm' }, 'SQFT', '48.438'],
  ])('measured in %s', (_name, dims, unit, want) => {
    expect(sizedQuantity(dims, unit)).toBe(want);
  });

  it('is exactly one square foot for 12 x 12 inches', () => {
    expect(sizedQuantity({ length: '12', width: '12', dimensionUnit: 'in' }, 'SQFT')).toBe('1');
  });
});

describe('hasSize / isSized', () => {
  it('needs both length and width', () => {
    expect(hasSize({ length: '10', width: '5' })).toBe(true);
    expect(hasSize({ length: '10' })).toBe(false);
    expect(hasSize({ slabs: '3' })).toBe(false);
  });

  it('also needs an area unit', () => {
    expect(isSized(TEN_BY_FIVE_FEET, 'SQFT')).toBe(true);
    expect(isSized(TEN_BY_FIVE_FEET, 'EA')).toBe(false);
  });
});

describe('withSizedQuantity', () => {
  it('replaces the quantity with the area on a sized line', () => {
    const line = { quantity: '999', units: 'SQFT', ...TEN_BY_FIVE_FEET, slabs: '3' };
    expect(withSizedQuantity(line).quantity).toBe('150');
  });

  it('uses the unit the line carries', () => {
    const line = { quantity: '1', units: 'SQFT', length: '120', width: '60', slabs: '2', dimensionUnit: 'in' };
    expect(withSizedQuantity(line).quantity).toBe('100');
  });

  it('leaves a typed quantity alone when no size is stated', () => {
    const line = { quantity: '12', units: 'SQFT' };
    expect(withSizedQuantity(line)).toBe(line);
  });

  it('leaves the last derived quantity editable once the size is cleared', () => {
    const line = { quantity: '150', units: 'SQFT', length: '', width: '', slabs: '' };
    expect(withSizedQuantity(line)).toBe(line);
  });

  it('never drops a size, so a unit being retyped does not wipe it', () => {
    const line = { quantity: '50', units: 'S', ...TEN_BY_FIVE_FEET, slabs: '2' };
    expect(withSizedQuantity(line)).toBe(line);
  });

  it('can take the slab count from elsewhere (a PO line\'s expected slabs)', () => {
    const line = { quantity: '1', units: 'SQFT', ...TEN_BY_FIVE_FEET };
    expect(withSizedQuantity(line, '4').quantity).toBe('200');
  });
});

describe('withoutUnsupportedSize', () => {
  it('drops dimensions from a line that is not in an area unit, keeping its quantity and unit', () => {
    const line = { quantity: '4', units: 'EA', ...TEN_BY_FIVE_FEET, slabs: '2', dimensionUnit: 'in' };
    expect(withoutUnsupportedSize(line)).toEqual({ quantity: '4', units: 'EA', length: '', width: '', slabs: '', dimensionUnit: 'in' });
  });

  it('drops them when the item was cleared (no unit)', () => {
    const line = { quantity: '4', units: '', ...TEN_BY_FIVE_FEET };
    expect(withoutUnsupportedSize(line).length).toBe('');
  });

  it('keeps them in an area unit', () => {
    const line = { quantity: '50', units: 'SQFT', ...TEN_BY_FIVE_FEET };
    expect(withoutUnsupportedSize(line)).toBe(line);
  });

  it('is a no-op when nothing is stated', () => {
    const line = { quantity: '4', units: 'EA' };
    expect(withoutUnsupportedSize(line)).toBe(line);
  });
});

describe('dimensionsPayload', () => {
  it.each([
    ['a sized line', { ...TEN_BY_FIVE_FEET, slabs: '3' }, 'SQFT', { length: 304.8, width: 152.4, slabs: 3, dimensionUnit: 'cm' }],
    ['carries the unit it was measured in', { length: '120', width: '60', slabs: '2', dimensionUnit: 'in' }, 'SQFT',
      { length: 120, width: 60, slabs: 2, dimensionUnit: 'in' }],
    ['a line with no unit is sent as inches', { length: '120', width: '60' }, 'SQFT', { length: 120, width: 60, dimensionUnit: 'in' }],
    ['blank slabs stays unset', { ...TEN_BY_FIVE_FEET }, 'SQFT', { length: 304.8, width: 152.4, dimensionUnit: 'cm' }],
    ['slabs alone', { slabs: '4' }, 'SQFT', { slabs: 4 }],
    ['a lone dimension sends neither', { length: '300', slabs: '2' }, 'SQFT', { slabs: 2 }],
    ['a non-area unit sends nothing', { ...TEN_BY_FIVE_FEET, slabs: '3' }, 'EA', {}],
    ['nothing stated', {}, 'SQFT', {}],
  ])('%s', (_name, dims, unit, want) => {
    expect(dimensionsPayload(dims, unit)).toEqual(want);
  });
});

describe('dimensionsFromLine', () => {
  it('stringifies what the server returned and blanks the rest', () => {
    expect(dimensionsFromLine({ length: 304.8, width: 152.4, slabs: 3, dimensionUnit: 'cm' }))
      .toEqual({ length: '304.8', width: '152.4', slabs: '3', dimensionUnit: 'cm' });
    expect(dimensionsFromLine({ length: null })).toEqual({ length: '', width: '', slabs: '', dimensionUnit: 'in' });
    expect(dimensionsFromLine({})).toEqual({ length: '', width: '', slabs: '', dimensionUnit: 'in' });
  });

  it('keeps the unit a saved line was measured in', () => {
    expect(dimensionsFromLine({ length: 120, width: 60, dimensionUnit: 'ft' }).dimensionUnit).toBe('ft');
  });
});

describe('sizeSummary', () => {
  it.each([
    ['size and slabs', { length: '300', width: '150', slabs: '2', dimensionUnit: 'cm' }, '300 × 150 cm · 2 slabs'],
    ['in inches', { length: '120', width: '60', slabs: '2', dimensionUnit: 'in' }, '120 × 60 in · 2 slabs'],
    ['with no unit it reads in inches', { length: '120', width: '60' }, '120 × 60 in'],
    ['one slab is singular', { length: '300', width: '150', slabs: '1', dimensionUnit: 'cm' }, '300 × 150 cm · 1 slab'],
    ['size without a count', { length: '300', width: '150', dimensionUnit: 'cm' }, '300 × 150 cm'],
    ['count without a size', { slabs: '4' }, '4 slabs'],
    ['nothing', {}, ''],
  ])('%s', (_name, dims, want) => {
    expect(sizeSummary(dims)).toBe(want);
  });
});

describe('maxDimension', () => {
  it('is 100 m, in whichever unit the line is measured', () => {
    expect(maxDimension('cm')).toBe(10000);
    expect(maxDimension('m')).toBe(100);
    expect(maxDimension('mm')).toBe(100000);
    expect(maxDimension('ft')).toBe(328.08);
    expect(maxDimension('in')).toBe(3937);
  });

  it('is measured in inches when no unit is given', () => {
    expect(maxDimension(undefined)).toBe(3937);
  });
});

describe('clamping', () => {
  it('keeps what was typed when it is in range, and blank blank', () => {
    expect(clampDimension('')).toBe('');
    expect(clampDimension('126.5')).toBe('126.5');
    expect(clampSlabs('3')).toBe('3');
  });

  it('floors negatives and caps absurd values in the line\'s unit', () => {
    expect(clampDimension('-4')).toBe('0');
    expect(clampDimension('99999', 'cm')).toBe('10000');
    expect(clampDimension('99999')).toBe('3937'); // inches by default
    expect(clampDimension('150', 'm')).toBe('100');
    expect(clampDimension('5000', 'in')).toBe('3937');
    expect(clampDimension('150000', 'mm')).toBe('100000');
    expect(clampSlabs('-1')).toBe('0');
    expect(clampSlabs('99999')).toBe('10000');
  });

  it('makes a slab count whole', () => {
    expect(clampSlabs('2.7')).toBe('2');
  });
});

describe('clampDimensionField', () => {
  it('routes each field to its own clamp and leaves other keys alone', () => {
    expect(clampDimensionField('length', '99999', 'cm')).toBe('10000');
    expect(clampDimensionField('width', '-1')).toBe('0');
    expect(clampDimensionField('length', '150', 'm')).toBe('100');
    expect(clampDimensionField('slabs', '2.9')).toBe('2');
    expect(clampDimensionField('quantity', '-7')).toBe('-7');
  });
});

describe('sanitizeDimensionInput', () => {
  it.each([
    // Typed: what is on the keyboard is kept, noise is dropped.
    ['length', '120', '120'],
    ['length', '12.5', '12.5'],
    ['length', '12.', '12.'], // mid-typing a decimal is not interrupted
    ['length', '.5', '0.5'],
    ['length', '.', '0.'],
    ['length', '', ''],
    ['length', '12a', '12'],
    ['length', 'e', ''],
    ['length', '-5', '5'],
    ['length', '007', '7'],
    ['length', '0', '0'],
    ['length', '0.5', '0.5'],
    // At most two places, and one decimal point.
    ['length', '120.555', '120.55'],
    ['width', '7..5', '7.5'],
    ['width', '1.2.3', '1.23'],
    // Pasted: thousands separators and units fall away.
    ['length', '1,200.5', '1200.5'],
    ['width', '120 in', '120'],
    // A slab count is whole.
    ['slabs', '3', '3'],
    ['slabs', '2.9', '2'],
    ['slabs', '.5', ''],
    ['slabs', '0012', '12'],
    ['slabs', 'ab', ''],
  ] as const)('%s %j -> %j', (field, raw, want) => {
    expect(sanitizeDimensionInput(field, raw)).toBe(want);
  });
});

describe('stepDimension', () => {
  it.each([
    // [field, from, direction, amount, want]
    ['length', '10', 1, 1, '11'],
    ['length', '10', -1, 1, '9'],
    ['length', '10', 1, 10, '20'],
    ['length', '12.5', 1, 1, '13.5'],
    ['length', '0.1', 1, 0.2, '0.3'], // no 0.30000000000000004
    ['length', '', 1, 1, '1'],
    ['width', '0', -1, 1, '0'], // never below zero
    ['length', '5', -1, 10, '0'],
    ['slabs', '3', 1, 1, '4'],
    ['slabs', '2.9', 1, 1, '3'],
    ['slabs', '1', -1, 1, '1'], // never below one
    ['slabs', '', 1, 1, '2'], // a blank slab count already means one
    ['slabs', '', -1, 1, '1'],
  ] as const)('%s %j step %i by %i -> %j', (field, from, direction, amount, want) => {
    expect(stepDimension(field, from, direction, amount)).toBe(want);
  });
});

describe('PDF columns', () => {
  it('only counts a document with a size or slab count', () => {
    expect(anyDimensions([{}, { length: null }])).toBe(false);
    expect(anyDimensions([{}, { length: 300, width: 150 }])).toBe(true);
    expect(anyDimensions([{ slabs: 2 }])).toBe(true);
  });

  it('prints each size with its unit and a dash for what a line leaves blank', () => {
    expect(dimensionCells({ length: 300, width: 150, slabs: 2, dimensionUnit: 'cm' })).toEqual(['300 cm', '150 cm', '2']);
    expect(dimensionCells({ length: 120, width: 60, slabs: 2, dimensionUnit: 'in' })).toEqual(['120 in', '60 in', '2']);
    expect(dimensionCells({ length: 120, width: 60 })).toEqual(['120 in', '60 in', '—']);
    expect(dimensionCells({})).toEqual(['—', '—', '—']);
  });

  it('can take the slab count from elsewhere', () => {
    expect(dimensionCells({ length: 300, width: 150, dimensionUnit: 'cm' }, 12)).toEqual(['300 cm', '150 cm', '12']);
  });
});

describe('dimensionToMm', () => {
  it.each([
    ['mm', 3048, 3048],
    ['cm', 304.8, 3048],
    ['in', 120, 3048],
    ['ft', 10, 3048],
    ['m', 3.048, 3048],
  ])('converts from %s', (unit, value, want) => {
    expect(dimensionToMm(value, unit)).toBe(want);
  });

  it('reads a missing unit as the default (inches)', () => {
    expect(dimensionToMm(120, undefined)).toBe(3048);
  });
});

describe('mmToDimension', () => {
  it.each([
    ['mm', 3048, 3048],
    ['cm', 3048, 304.8],
    ['in', 3048, 120],
    ['ft', 3048, 10],
    ['m', 3048, 3.048],
    // To hundredths, like every dimension: 30 mm is 1.18 in.
    ['in', 30, 1.18],
  ])('shows millimetres in %s', (unit, mm, want) => {
    expect(mmToDimension(mm, unit)).toBe(want);
  });

  it('reads a missing unit as the default (inches)', () => {
    expect(mmToDimension(3048, undefined)).toBe(120);
  });

  it('round-trips a typed value', () => {
    expect(mmToDimension(dimensionToMm(96.5, 'in'), 'in')).toBe(96.5);
  });
});
