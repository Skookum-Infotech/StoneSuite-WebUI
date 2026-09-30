import { describe, it, expect } from 'vitest';
import { estimateQuantity, impliedAverage, toExpectedSlabs } from './slabEstimate';

describe('estimateQuantity', () => {
  it.each([
    ['whole numbers', '12', '50', '600'],
    ['a fractional average', '12', '48.5', '582'],
    ['a fractional result', '11', '52.3', '575.3'],
    ['rounds to three decimals', '7', '12.3456', '86.419'],
    ['one slab', '1', '47.25', '47.25'],
    ['whitespace around a number', ' 4 ', ' 50 ', '200'],
  ])('%s', (_name, slabs, avg, want) => {
    expect(estimateQuantity(slabs, avg)).toBe(want);
  });

  it.each([
    ['no slabs', '', '50'],
    ['no average', '12', ''],
    ['neither', '', ''],
    ['zero slabs', '0', '50'],
    ['zero average', '12', '0'],
    ['negative slabs', '-2', '50'],
    ['negative average', '12', '-5'],
    ['text', 'abc', '50'],
  ])('is blank for %s, so a half-typed helper never overwrites the quantity', (_name, slabs, avg) => {
    expect(estimateQuantity(slabs, avg)).toBe('');
  });
});

describe('impliedAverage', () => {
  it('works back from a saved line', () => {
    expect(impliedAverage('600', '12')).toBe('50');
    expect(impliedAverage('583.4', '12')).toBe('48.617');
  });

  it.each([
    ['no slab count', '600', ''],
    ['no quantity', '', '12'],
    ['zero slabs', '600', '0'],
    ['zero quantity', '0', '12'],
  ])('is blank with %s', (_name, quantity, slabs) => {
    expect(impliedAverage(quantity, slabs)).toBe('');
  });

  it('round-trips with estimateQuantity for a tidy average', () => {
    expect(estimateQuantity('12', impliedAverage('600', '12'))).toBe('600');
  });
});

describe('toExpectedSlabs', () => {
  it.each([
    ['12', 12],
    [' 7 ', 7],
    ['1', 1],
    ['12.9', 12],
  ])('%j → %i', (raw, want) => {
    expect(toExpectedSlabs(raw)).toBe(want);
  });

  it.each([[''], ['0'], ['-3'], ['abc'], [undefined], [null]])('%j → undefined', (raw) => {
    expect(toExpectedSlabs(raw)).toBeUndefined();
  });
});
