import { describe, expect, it } from 'vitest';
import { AREA_KINDS, areaHasField, areaKindConfig, FAUCET_SPREAD_OPTIONS } from './createdOrderAreas';
import type { AreaKind } from '@/types/createdOrder';

const ALL_KINDS: AreaKind[] = [
  'kitchen',
  'island',
  'pantry',
  'hutch',
  'utility',
  'master_bath',
  'powder_1',
  'powder_2',
  'bath',
  'custom',
];

describe('area catalog', () => {
  it('has exactly one entry per area kind', () => {
    expect(AREA_KINDS.map((a) => a.kind).sort()).toEqual([...ALL_KINDS].sort());
  });

  it('only lets Bath and Custom area repeat', () => {
    const repeatable = AREA_KINDS.filter((a) => a.repeatable).map((a) => a.kind);

    expect(repeatable.sort()).toEqual(['bath', 'custom']);
  });

  // The field sets below are read straight off the printed Countertop Order Form.
  it.each<[AreaKind, string[]]>([
    ['kitchen', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel', 'cooktopModel', 'waterfallQty']],
    ['island', ['color', 'finish', 'edge', 'sinkModel', 'cooktopModel', 'waterfallQty', 'popUpOutlet']],
    ['pantry', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel']],
    ['hutch', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel']],
    ['utility', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel']],
    ['master_bath', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel', 'waterfallQty', 'halfWall']],
    ['powder_1', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel', 'location']],
    ['powder_2', ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel', 'location']],
  ])('%s shows the fields the paper form shows', (kind, fields) => {
    expect([...areaKindConfig(kind).fields].sort()).toEqual([...fields].sort());
  });

  it('gives the island a pop-up outlet but no backsplash height', () => {
    expect(areaHasField('island', 'popUpOutlet')).toBe(true);
    expect(areaHasField('island', 'backsplashHeight')).toBe(false);
  });

  it('uses the wide faucet row for kitchen-type areas and the narrow row for baths', () => {
    expect(areaKindConfig('kitchen').spreadScale).toBe('wide');
    expect(areaKindConfig('hutch').spreadScale).toBe('wide');
    expect(areaKindConfig('master_bath').spreadScale).toBe('narrow');
    expect(areaKindConfig('bath').spreadScale).toBe('narrow');
  });
});

describe('faucet spread rows', () => {
  it('prints the wide row as 12" 8" 4" C 4" 8" 12"', () => {
    expect(FAUCET_SPREAD_OPTIONS.wide.map((o) => o.label)).toEqual(['12"', '8"', '4"', 'C', '4"', '8"', '12"']);
  });

  it('prints the narrow row as 8" 4" 2" C 2" 4" 8"', () => {
    expect(FAUCET_SPREAD_OPTIONS.narrow.map((o) => o.label)).toEqual(['8"', '4"', '2"', 'C', '2"', '4"', '8"']);
  });

  it('gives every chip a distinct value so left and right toggle independently', () => {
    for (const row of Object.values(FAUCET_SPREAD_OPTIONS)) {
      const values = row.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
