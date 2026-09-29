import { describe, it, expect } from 'vitest';
import {
  newDraftSlab, draftSlabFromLine, slabArea, slabsTotalArea, slabProblem, toSlabInput,
  formatSlabSerial, previewSerials,
} from './itemReceiptSlabs';

// 3048 x 1524 mm is exactly 10 ft x 5 ft.
const TEN_BY_FIVE_FEET = 50;

describe('slabArea', () => {
  it.each([
    ['square feet', '3048', '1524', 'SQFT', TEN_BY_FIVE_FEET],
    ['square metres', '3000', '1500', 'SQM', 4.5],
    ['fractional input', '3048.5', '1524', 'SQFT', 50.008],
    ['missing width', '3048', '', 'SQFT', 0],
    ['zero length', '0', '1524', 'SQFT', 0],
    ['negative length', '-5', '1524', 'SQFT', 0],
    ['text in a dimension', 'abc', '1524', 'SQFT', 0],
    ['a unit that is not an area unit', '3048', '1524', 'EA', 0],
    ['blank unit', '3048', '1524', '', 0],
  ])('%s', (_name, length, width, unit, want) => {
    expect(slabArea(length, width, unit)).toBeCloseTo(want, 3);
  });
});

describe('slabsTotalArea', () => {
  it('sums each slab and rounds once', () => {
    const slabs = [
      newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' }),
      newDraftSlab({ lengthMm: '1524', widthMm: '1524', thicknessMm: '20' }),
    ];
    expect(slabsTotalArea(slabs, 'SQFT')).toBeCloseTo(75, 3);
  });

  it('is zero for no slabs, and ignores incomplete rows', () => {
    expect(slabsTotalArea([], 'SQFT')).toBe(0);
    expect(slabsTotalArea([newDraftSlab({ lengthMm: '3048' })], 'SQFT')).toBe(0);
  });
});

describe('slabProblem', () => {
  it('accepts a slab with all three dimensions', () => {
    expect(slabProblem(newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' }))).toBeNull();
  });

  it.each([
    ['blank', {}],
    ['no thickness', { lengthMm: '3048', widthMm: '1524' }],
    ['zero width', { lengthMm: '3048', widthMm: '0', thicknessMm: '30' }],
    ['negative length', { lengthMm: '-1', widthMm: '1524', thicknessMm: '30' }],
  ])('rejects %s', (_name, seed) => {
    expect(slabProblem(newDraftSlab(seed))).toMatch(/greater than zero/);
  });
});

describe('toSlabInput', () => {
  it('parses dimensions and drops blank optional fields', () => {
    const got = toSlabInput(newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', lot: '  ' }));
    expect(got).toEqual({
      lengthMm: 3048, widthMm: 1524, thicknessMm: 30,
      binId: undefined, blockId: undefined, lot: undefined, grade: undefined, supplierCode: undefined,
    });
  });

  it('trims and carries the optional fields', () => {
    const got = toSlabInput(newDraftSlab({
      lengthMm: '3048', widthMm: '1524', thicknessMm: '30',
      binId: 'bin-1', blockId: ' B7 ', lot: ' L2 ', grade: ' A ', supplierCode: ' S-1 ',
    }));
    expect(got).toMatchObject({ binId: 'bin-1', blockId: 'B7', lot: 'L2', grade: 'A', supplierCode: 'S-1' });
  });
});

describe('newDraftSlab', () => {
  it('gives every row its own key', () => {
    expect(newDraftSlab().key).not.toBe(newDraftSlab().key);
  });

  it('seeds a duplicate without reusing the source key', () => {
    const src = newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', lot: 'L1' });
    const copy = newDraftSlab(src);
    expect(copy.lengthMm).toBe('3048');
    expect(copy.lot).toBe('L1');
    expect(copy.key).not.toBe(src.key);
  });
});

describe('draftSlabFromLine', () => {
  it('rebuilds an editable row from a saved slab', () => {
    const got = draftSlabFromLine({
      lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50,
      binId: 'bin-9', lot: 'L4', serial: 'PORD-000001-001',
    });
    expect(got).toMatchObject({
      lengthMm: '3048', widthMm: '1524', thicknessMm: '30', binId: 'bin-9', lot: 'L4', blockId: '', grade: '',
    });
  });

  it('treats a null bin as unset', () => {
    expect(draftSlabFromLine({ lengthMm: 1, widthMm: 1, thicknessMm: 1, area: 0, binId: null }).binId).toBe('');
  });
});

describe('formatSlabSerial', () => {
  it.each([
    [1, 'PORD-000012-001'],
    [42, 'PORD-000012-042'],
    [999, 'PORD-000012-999'],
    [1000, 'PORD-000012-1000'],
  ])('%i', (n, want) => {
    expect(formatSlabSerial('PORD-000012-', n)).toBe(want);
  });
});

describe('previewSerials', () => {
  const slab = () => newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' });
  const seq = { prefix: 'PORD-000012-', next: 4 };

  it('numbers slabs continuously down the receipt, line by line', () => {
    const got = previewSerials(
      [
        { purchaseOrderItemId: 'a', slabs: [slab(), slab()] },
        { purchaseOrderItemId: 'b', slabs: [] },
        { purchaseOrderItemId: 'c', slabs: [slab()] },
      ],
      seq,
    );
    expect(got).toEqual({
      a: ['PORD-000012-004', 'PORD-000012-005'],
      c: ['PORD-000012-006'],
    });
  });

  it('gives blanks while the sequence is still loading', () => {
    expect(previewSerials([{ purchaseOrderItemId: 'a', slabs: [slab(), slab()] }], undefined)).toEqual({ a: ['', ''] });
  });

  it('has nothing to preview without slabs', () => {
    expect(previewSerials([{ purchaseOrderItemId: 'a', slabs: [] }], seq)).toEqual({});
  });
});
