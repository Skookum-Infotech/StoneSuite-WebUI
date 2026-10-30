import { describe, expect, it } from 'vitest';
import {
  arrivalProgressText, arrivedArea, arrivedSlabs, onOrderDraftsForLine, onOrderSlabArea, onOrderSlabProblem,
  setAllArrived, setArrived, setBin, setBinForArrived, setThickness, toOnOrderInput, type OnOrderSlabDraft,
} from '@/lib/onOrderSlabs';
import type { ItemReceiptLineSlab, OnOrderSlab } from '@/types/itemReceipt';

const TEN_BY_FIVE_FEET_MM = { lengthMm: 3048, widthMm: 1524 }; // 50 sq ft

function onOrder(overrides: Partial<OnOrderSlab> = {}): OnOrderSlab {
  return {
    id: 'slab-1', serial: 'PORD-000012-001', purchaseOrderItemId: 'line-1',
    ...TEN_BY_FIVE_FEET_MM, thicknessMm: 30, area: 50, ...overrides,
  };
}

function draft(overrides: Partial<OnOrderSlabDraft> = {}): OnOrderSlabDraft {
  return {
    id: 'slab-1', serial: 'PORD-000012-001', ...TEN_BY_FIVE_FEET_MM,
    orderedThicknessMm: 30, thicknessMm: '30', arrived: false, binId: '', ...overrides,
  };
}

describe('onOrderDraftsForLine', () => {
  const slabs = [
    onOrder({ id: 'a', serial: 'PORD-000012-001' }),
    onOrder({ id: 'b', serial: 'PORD-000012-002' }),
    onOrder({ id: 'c', serial: 'PORD-000013-001', purchaseOrderItemId: 'line-2' }),
  ];

  it('lists only the slabs ordered on this line, none ticked', () => {
    const drafts = onOrderDraftsForLine(slabs, 'line-1');
    expect(drafts.map((d) => d.serial)).toEqual(['PORD-000012-001', 'PORD-000012-002']);
    expect(drafts.every((d) => !d.arrived)).toBe(true);
  });

  it('seeds the thickness from the order, and blank when the order left it out', () => {
    expect(onOrderDraftsForLine([onOrder({ thicknessMm: 19.05 })], 'line-1')[0]).toMatchObject({
      orderedThicknessMm: 19.05, thicknessMm: '19.05',
    });
    expect(onOrderDraftsForLine([onOrder({ thicknessMm: 0 })], 'line-1')[0]).toMatchObject({
      orderedThicknessMm: 0, thicknessMm: '',
    });
  });

  it('comes back ticked, with the saved thickness, for slabs a pending receipt already claims', () => {
    const claimed: ItemReceiptLineSlab[] = [
      { onOrderSlabId: 'b', lengthMm: 3048, widthMm: 1524, thicknessMm: 25, area: 50, binId: 'bin-9' },
    ];
    const drafts = onOrderDraftsForLine([onOrder({ id: 'a' }), onOrder({ id: 'b', thicknessMm: 0 })], 'line-1', claimed);

    expect(drafts.map((d) => d.arrived)).toEqual([false, true]);
    expect(drafts[1].thicknessMm).toBe('25');
    expect(drafts.map((d) => d.binId)).toEqual(['', 'bin-9']); // each slab keeps its own saved bin
  });

  it('is empty for a line nothing was ordered on', () => {
    expect(onOrderDraftsForLine(slabs, 'line-9')).toEqual([]);
  });
});

describe('ticking', () => {
  const drafts = [draft({ id: 'a' }), draft({ id: 'b' }), draft({ id: 'c' })];

  it('ticks one slab and leaves the rest alone', () => {
    const next = setArrived(drafts, 'b', true);
    expect(next.map((d) => d.arrived)).toEqual([false, true, false]);
    expect(drafts.every((d) => !d.arrived)).toBe(true); // the input is never mutated
  });

  it('ticks and clears them all', () => {
    expect(setAllArrived(drafts, true).every((d) => d.arrived)).toBe(true);
    expect(setAllArrived(setAllArrived(drafts, true), false).every((d) => !d.arrived)).toBe(true);
  });

  it('puts one slab in a bin and leaves the rest alone', () => {
    expect(setBin(drafts, 'b', 'bin-1').map((d) => d.binId)).toEqual(['', 'bin-1', '']);
    expect(setBin(setBin(drafts, 'b', 'bin-1'), 'b', '')[1].binId).toBe(''); // back to no bin
  });

  it('puts every ticked slab in one bin, keeping what the others had', () => {
    const mixed = [draft({ id: 'a', arrived: true }), draft({ id: 'b', binId: 'bin-7' }), draft({ id: 'c', arrived: true })];
    expect(setBinForArrived(mixed, 'bin-2').map((d) => d.binId)).toEqual(['bin-2', 'bin-7', 'bin-2']);
    expect(setBinForArrived(drafts, 'bin-2').every((d) => d.binId === '')).toBe(true); // nothing ticked
  });

  it('lists what is ticked', () => {
    expect(arrivedSlabs(setArrived(drafts, 'c', true)).map((d) => d.id)).toEqual(['c']);
  });

  it('sets one slab\'s thickness', () => {
    const next = setThickness(drafts, 'a', '22.5');
    expect(next.map((d) => d.thicknessMm)).toEqual(['22.5', '30', '30']);
  });
});

describe('arrivedArea', () => {
  const drafts = [draft({ id: 'a' }), draft({ id: 'b' }), draft({ id: 'c' })];

  it('is the area of the ticked slabs only, in the line\'s unit', () => {
    expect(onOrderSlabArea(drafts[0], 'SQFT')).toBe(50);
    expect(arrivedArea(drafts, 'SQFT')).toBe(0);
    expect(arrivedArea(setArrived(setArrived(drafts, 'a', true), 'c', true), 'SQFT')).toBe(100);
  });

  it('is 0 on a unit that is not an area', () => {
    expect(arrivedArea(setAllArrived(drafts, true), 'EA')).toBe(0);
  });

  it('works in square metres', () => {
    const one = [draft({ lengthMm: 2000, widthMm: 1000, arrived: true })];
    expect(arrivedArea(one, 'SQM')).toBe(2);
  });
});

describe('onOrderSlabProblem', () => {
  it('only a ticked slab can have a problem', () => {
    expect(onOrderSlabProblem(draft({ thicknessMm: '', arrived: false }))).toBeNull();
  });

  it.each(['', '0', 'abc', '-3'])('a ticked slab with thickness %j needs one', (thicknessMm) => {
    expect(onOrderSlabProblem(draft({ arrived: true, thicknessMm }))).toBe('slab PORD-000012-001: thickness must be greater than zero.');
  });

  it('a ticked slab with a thickness is fine', () => {
    expect(onOrderSlabProblem(draft({ arrived: true, thicknessMm: '25' }))).toBeNull();
  });
});

describe('toOnOrderInput', () => {
  it('names the slab and carries its size, thickness and bin', () => {
    expect(toOnOrderInput(draft({ arrived: true, thicknessMm: '25.4', binId: 'bin-1' }))).toEqual({
      onOrderSlabId: 'slab-1', lengthMm: 3048, widthMm: 1524, thicknessMm: 25.4, binId: 'bin-1',
    });
  });

  it('omits a blank bin', () => {
    expect(toOnOrderInput(draft({ arrived: true, binId: '  ' })).binId).toBeUndefined();
    expect(toOnOrderInput(draft({ arrived: true })).binId).toBeUndefined();
  });
});

describe('arrivalProgressText', () => {
  it.each([[0, 10, '0 of 10 slabs arrived'], [3, 10, '3 of 10 slabs arrived'], [1, 1, '1 of 1 slab arrived']])(
    '%i of %i', (arrived, total, want) => {
      expect(arrivalProgressText(arrived, total)).toBe(want);
    },
  );
});
