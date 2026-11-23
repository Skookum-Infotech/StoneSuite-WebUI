import { describe, it, expect } from 'vitest';
import { toExpectedSlabs } from './slabEstimate';

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
