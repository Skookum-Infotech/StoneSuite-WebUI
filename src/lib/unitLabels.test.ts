import { describe, it, expect } from 'vitest';
import { unitLabel } from './unitLabels';

describe('unitLabel', () => {
  it.each([
    ['EA', 'Each'],
    ['BOX', 'Box'],
    ['SET', 'Set'],
    ['PLT', 'Pallet'],
    ['SLAB', 'Slab'],
    ['SQFT', 'Sq ft'],
    ['SQM', 'Sq m'],
    ['LFT', 'Lin ft'],
    ['KG', 'kg'],
    ['LB', 'lb'],
  ])('%s → %s', (code, want) => {
    expect(unitLabel(code)).toBe(want);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(unitLabel('sqft')).toBe('Sq ft');
    expect(unitLabel('  Ea ')).toBe('Each');
  });

  it('shows an unrecognised code as it is, rather than hiding it', () => {
    expect(unitLabel('BUNDLE')).toBe('BUNDLE');
  });

  it.each([[''], [null], [undefined]])('is empty for %j', (code) => {
    expect(unitLabel(code)).toBe('');
  });
});
