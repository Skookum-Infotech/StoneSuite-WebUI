import { describe, it, expect } from 'vitest';
import {
  newDraftSlab, draftSlabFromLine, slabArea, slabsTotalArea, slabProblem, toSlabInput,
  formatSlabSerial, previewSerials, generateSlabs, MAX_GENERATED_SLABS,
  slabGroupKey, groupSlabs, patchGroupMembers, assignBin, countReached, pageOf, SLAB_PAGE_SIZE,
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

describe('generateSlabs', () => {
  const defaults = { lengthMm: '3048', widthMm: '1524', thicknessMm: '30', binId: 'bin-1' };

  it('makes one prefilled row per arrived slab, each with its own key', () => {
    const rows = generateSlabs(60, defaults);
    expect(rows).toHaveLength(60);
    expect(new Set(rows.map((r) => r.key)).size).toBe(60);
    expect(rows.every((r) => r.lengthMm === '3048' && r.widthMm === '1524' && r.thicknessMm === '30' && r.binId === 'bin-1')).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['not a number', Number.NaN],
    ['fractional', 2.5],
    ['infinite', Number.POSITIVE_INFINITY],
    ['above the limit', MAX_GENERATED_SLABS + 1],
  ])('generates nothing for a count that is %s', (_name, count) => {
    expect(generateSlabs(count, defaults)).toEqual([]);
  });

  it('allows exactly the limit', () => {
    expect(generateSlabs(MAX_GENERATED_SLABS, defaults)).toHaveLength(MAX_GENERATED_SLABS);
  });

  it('leaves thickness blank, never zero, when no default is known', () => {
    const [row] = generateSlabs(1, { lengthMm: '3048', widthMm: '1524' });
    expect(row.thicknessMm).toBe('');
  });
});

describe('slabGroupKey', () => {
  const base = { lengthMm: '3048', widthMm: '1524', thicknessMm: '30', binId: 'bin-1' };

  it('ignores the supplier code, which identifies one physical slab', () => {
    expect(slabGroupKey(newDraftSlab({ ...base, supplierCode: 'A1' }))).toBe(slabGroupKey(newDraftSlab({ ...base, supplierCode: 'B2' })));
  });

  it.each([
    ['bin', { binId: 'bin-2' }],
    ['length', { lengthMm: '3000' }],
    ['lot', { lot: 'L9' }],
    ['grade', { grade: 'A' }],
    ['block', { blockId: 'B7' }],
  ])('separates slabs that differ in %s', (_name, change) => {
    expect(slabGroupKey(newDraftSlab(base))).not.toBe(slabGroupKey(newDraftSlab({ ...base, ...change })));
  });
});

describe('groupSlabs', () => {
  const same = () => newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' });

  it('collapses identical slabs and keeps first-appearance order', () => {
    const odd = newDraftSlab({ lengthMm: '3000', widthMm: '1524', thicknessMm: '30' });
    const slabs = [...Array.from({ length: 60 }, same), odd, same()];
    const groups = groupSlabs(slabs);
    expect(groups.map((g) => g.count)).toEqual([61, 1]);
    expect(groups[0].memberKeys).toHaveLength(61);
    expect(groups[1].sample.key).toBe(odd.key);
  });

  it('has no groups for no slabs', () => {
    expect(groupSlabs([])).toEqual([]);
  });
});

describe('patchGroupMembers', () => {
  it('changes only the named fields and leaves each supplier code alone', () => {
    const a = newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', supplierCode: 'A1' });
    const b = newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', supplierCode: 'B2' });
    const other = newDraftSlab({ lengthMm: '1', widthMm: '1', thicknessMm: '1', supplierCode: 'Z9' });
    const out = patchGroupMembers([a, b, other], [a.key, b.key], { binId: 'bin-7' });
    expect(out.map((s) => s.binId)).toEqual(['bin-7', 'bin-7', '']);
    expect(out.map((s) => s.supplierCode)).toEqual(['A1', 'B2', 'Z9']);
  });
});

describe('assignBin', () => {
  const five = () => Array.from({ length: 5 }, (_, i) => newDraftSlab({ lengthMm: String(1000 + i) }));

  it('puts every slab in the bin by default', () => {
    expect(assignBin(five(), 'bin-1', {}).map((s) => s.binId)).toEqual(Array(5).fill('bin-1'));
  });

  it('takes a range of positions, counted from 1 and inclusive', () => {
    const out = assignBin(five(), 'bin-1', { from: 2, to: 4 });
    expect(out.map((s) => s.binId)).toEqual(['', 'bin-1', 'bin-1', 'bin-1', '']);
  });

  it('runs to the last slab when no end is given, and from the first when no start is given', () => {
    expect(assignBin(five(), 'b', { from: 4 }).map((s) => s.binId)).toEqual(['', '', '', 'b', 'b']);
    expect(assignBin(five(), 'b', { to: 2 }).map((s) => s.binId)).toEqual(['b', 'b', '', '', '']);
  });

  it('can leave slabs that already have a bin alone', () => {
    const slabs = five();
    slabs[1] = { ...slabs[1], binId: 'bin-old' };
    const out = assignBin(slabs, 'bin-new', { onlyUnassigned: true });
    expect(out.map((s) => s.binId)).toEqual(['bin-new', 'bin-old', 'bin-new', 'bin-new', 'bin-new']);
  });

  it('clears the bin when given none', () => {
    const slabs = five().map((s) => ({ ...s, binId: 'bin-1' }));
    expect(assignBin(slabs, '', { from: 1, to: 2 }).map((s) => s.binId)).toEqual(['', '', 'bin-1', 'bin-1', 'bin-1']);
  });

  it('keeps every slab its own size and key', () => {
    const slabs = five();
    const out = assignBin(slabs, 'bin-1', {});
    expect(out.map((s) => s.key)).toEqual(slabs.map((s) => s.key));
    expect(out.map((s) => s.lengthMm)).toEqual(slabs.map((s) => s.lengthMm));
  });
});

describe('pageOf', () => {
  const items = Array.from({ length: 60 }, (_, i) => i);

  it('slices a page and says where it starts', () => {
    const p = pageOf(items, 2);
    expect(p.items).toEqual(items.slice(SLAB_PAGE_SIZE, SLAB_PAGE_SIZE * 2));
    expect(p.offset).toBe(SLAB_PAGE_SIZE);
    expect(p.pageCount).toBe(3);
    expect(p.total).toBe(60);
    expect(p.page).toBe(2);
  });

  it('holds a short list on one page', () => {
    expect(pageOf(items.slice(0, 5), 1)).toMatchObject({ pageCount: 1, offset: 0, page: 1 });
  });

  it('pulls a page past the end back to the last one, as when rows are removed', () => {
    expect(pageOf(items, 9)).toMatchObject({ page: 3, offset: SLAB_PAGE_SIZE * 2 });
    expect(pageOf(items, 0)).toMatchObject({ page: 1, offset: 0 });
  });

  it('copes with nothing to show', () => {
    expect(pageOf([], 1)).toMatchObject({ items: [], pageCount: 1, page: 1 });
  });
});
describe('countReached', () => {
  const four = () => Array.from({ length: 4 }, () => newDraftSlab());

  it('counts the slabs a bulk assignment would set', () => {
    expect(countReached(four(), {})).toBe(4);
    expect(countReached(four(), { from: 2, to: 3 })).toBe(2);
  });

  it('leaves out slabs that already have a bin when asked to', () => {
    const slabs = four();
    slabs[0] = { ...slabs[0], binId: 'bin-1' };
    expect(countReached(slabs, { onlyUnassigned: true })).toBe(3);
  });

  it('is zero for a range outside the line', () => {
    expect(countReached(four(), { from: 9, to: 12 })).toBe(0);
  });
});

describe('slabProblem — says what is missing', () => {
  const sized = { lengthMm: '3048', widthMm: '1524', thicknessMm: '30' };

  it.each([
    [{ ...sized, thicknessMm: '' }, 'thickness must be greater than zero.'],
    [{ ...sized, lengthMm: '' }, 'length must be greater than zero.'],
    [{ ...sized, widthMm: '0' }, 'width must be greater than zero.'],
    [{ ...sized, widthMm: '', thicknessMm: '' }, 'width and thickness must be greater than zero.'],
    [{ ...sized, lengthMm: '', widthMm: '' }, 'length and width must be greater than zero.'],
    [{}, 'length, width and thickness must all be greater than zero.'],
  ])('%j -> %s', (seed, want) => {
    expect(slabProblem(newDraftSlab(seed))).toBe(want);
  });
});
