import { describe, it, expect } from 'vitest';
import {
  asShortage, basisLabel, coveragePercent, describeShortfall, materialState, missingFromStock,
} from './fabricationMaterials';
import type { FabricationMaterial } from '@/types/fabrication';

const mat = (over: Partial<FabricationMaterial> = {}): FabricationMaterial => ({
  itemId: 'i1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT',
  ordered: 60, needed: 32.292, basis: 'blueprint', pieceCount: 1,
  allocated: 0, consumed: 0, inStock: 90.416, shortfall: 32.292, ...over,
});

describe('materialState', () => {
  it.each([
    ['nothing more needed', mat({ allocated: 45.208, shortfall: 0 }), 'covered'],
    ['short, and the shelf has it', mat({ shortfall: 32.292, inStock: 90.416 }), 'short'],
    ['short, and the shelf has exactly enough', mat({ shortfall: 40, inStock: 40 }), 'short'],
    ['short of more than the shelf holds', mat({ shortfall: 50, inStock: 45.208 }), 'unstocked'],
    ['short with nothing on the shelf', mat({ shortfall: 10, inStock: 0 }), 'unstocked'],
  ])('%s', (_name, m, want) => {
    expect(materialState(m)).toBe(want);
  });
});

describe('coveragePercent', () => {
  it.each([
    [mat({ needed: 40, allocated: 10 }), 25],
    [mat({ needed: 40, allocated: 40 }), 100],
    [mat({ needed: 40, allocated: 90 }), 100],
    [mat({ needed: 0, allocated: 0 }), 100],
    [mat({ needed: 40, allocated: 0 }), 0],
  ])('%#', (m, want) => {
    expect(coveragePercent(m)).toBe(want);
  });
});

describe('basisLabel', () => {
  it('names the pieces the need was drawn from', () => {
    expect(basisLabel(mat({ pieceCount: 1 }))).toBe('Blueprint · 1 piece');
    expect(basisLabel(mat({ pieceCount: 4 }))).toBe('Blueprint · 4 pieces');
  });

  it('says so when it is only the ordered quantity', () => {
    expect(basisLabel(mat({ basis: 'order', pieceCount: 0 }))).toBe('Ordered quantity — no pieces drawn yet');
  });
});

describe('what the shelf lacks', () => {
  it('is the shortfall beyond what is in stock', () => {
    expect(missingFromStock(mat({ shortfall: 50, inStock: 45.208 }))).toBeCloseTo(4.792, 6);
    expect(missingFromStock(mat({ shortfall: 20, inStock: 45.208 }))).toBe(0);
    expect(missingFromStock(mat({ shortfall: 0, inStock: 0 }))).toBe(0);
  });

  it('becomes a shortage to restock, or nothing when the shelf covers it', () => {
    expect(asShortage(mat({ shortfall: 50, inStock: 45.208 }))).toEqual({
      itemId: 'i1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT',
      requested: 50, available: 45.208, short: 50 - 45.208,
    });
    expect(asShortage(mat({ shortfall: 20, inStock: 45.208 }))).toBeNull();
  });

  it('describes what is left to allocate', () => {
    expect(describeShortfall(mat({ shortfall: 32.292 }))).toBe('32.292 sq ft more to allocate');
  });
});
