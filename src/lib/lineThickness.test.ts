import { describe, expect, it } from 'vitest';
import {
  maxThickness, sanitizeThickness, thicknessFromItemMm, thicknessPayload, thicknessText,
} from '@/lib/lineThickness';

describe('maxThickness', () => {
  it.each<[string | undefined, number]>([
    ['cm', 100], ['mm', 1000], ['m', 1], ['in', 39.37], ['ft', 3.28], [undefined, 39.37], ['yd', 39.37],
  ])('%s -> %d', (unit, expected) => {
    expect(maxThickness(unit)).toBe(expected);
  });
});

describe('sanitizeThickness', () => {
  it.each<[string, string | undefined, string]>([
    ['0.75', 'in', '0.75'],
    ['1,5', 'in', '15'],
    ['0.756', 'in', '0.75'],
    ['abc', 'in', ''],
    ['12.', 'cm', '12.'],
    ['500', 'cm', '100'],
    ['50', 'in', '39.37'],
    ['', 'cm', ''],
  ])('%j in %s -> %j', (raw, unit, expected) => {
    expect(sanitizeThickness(raw, unit)).toBe(expected);
  });
});

describe('thicknessPayload', () => {
  it.each<[string | undefined, string | undefined, number | undefined]>([
    ['0.75', 'SQFT', 0.75],
    ['3', 'SQM', 3],
    ['0.754', 'SQFT', 0.75],
    ['', 'SQFT', undefined],
    [undefined, 'SQFT', undefined],
    ['0', 'SQFT', undefined],
    ['0.004', 'SQFT', undefined],
    ['-2', 'SQFT', undefined],
    ['abc', 'SQFT', undefined],
    ['0.75', 'EA', undefined],
    ['0.75', undefined, undefined],
  ])('%j on %s -> %s', (raw, areaUnit, expected) => {
    expect(thicknessPayload(raw, areaUnit)).toBe(expected);
  });
});

describe('thicknessFromItemMm', () => {
  it.each<[number | null | undefined, string | undefined, string | undefined, string]>([
    [30, 'mm', 'SQFT', '30'],
    [30, 'cm', 'SQFT', '3'],
    [19.05, 'in', 'SQFT', '0.75'],
    [0, 'in', 'SQFT', ''],
    [null, 'in', 'SQFT', ''],
    [undefined, 'in', 'SQFT', ''],
    [30, 'in', 'EA', ''],
  ])('%s mm in %s on %s -> %j', (mm, unit, areaUnit, expected) => {
    expect(thicknessFromItemMm(mm, unit, areaUnit)).toBe(expected);
  });
});

describe('thicknessText', () => {
  it('shows a saved thickness and blanks a missing one', () => {
    expect(thicknessText(0.75)).toBe('0.75');
    expect(thicknessText(null)).toBe('');
    expect(thicknessText(undefined)).toBe('');
  });
});
