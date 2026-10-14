import { describe, it, expect } from 'vitest';
import { makeUnit } from '@/pages/inventory/unit/components/unitFixtures';
import type { BinTransferLine } from '@/types/binTransfer';
import {
  draftLineFromUnit, draftLineFromRecord, addUnits, applyDestinationToAll,
  toLineInputs, validateDraft, summarizeDraft,
} from './binTransferLines';

const A = makeUnit({ id: 'u-a', serial: 'SLB-1', area: 40, binId: 'bin-yard', binPath: 'YARD/A1' });
const B = makeUnit({ id: 'u-b', serial: 'SLB-2', area: 20.5, binId: null, binPath: '' });

describe('draftLineFromUnit', () => {
  it('carries what the editor shows and starts with no destination', () => {
    expect(draftLineFromUnit(A)).toMatchObject({
      unitId: 'u-a', serial: 'SLB-1', itemName: 'Absolute Black', area: 40, areaUnitCode: 'SQFT',
      currentBinId: 'bin-yard', currentBinPath: 'YARD/A1', toBinId: '', notes: '',
    });
  });

  it('gives each line its own client key', () => {
    expect(draftLineFromUnit(A).key).not.toBe(draftLineFromUnit(A).key);
  });
});

describe('draftLineFromRecord', () => {
  it('rebuilds a line of a saved transfer for the edit page', () => {
    const rec: BinTransferLine = {
      id: '7', lineNumber: 1, unitId: 'u-a', unitSerial: 'SLB-1', unitStatus: 'available',
      inventoryItemName: 'Absolute Black', area: 40, areaUnitCode: 'SQFT',
      fromBinId: 'bin-yard', fromBinPath: 'YARD/A1', currentBinPath: 'YARD/A2',
      toBinId: 'bin-rack', toBinPath: 'RACK/B2', notes: 'top of stack',
    };
    expect(draftLineFromRecord(rec)).toMatchObject({
      unitId: 'u-a', serial: 'SLB-1', toBinId: 'bin-rack', notes: 'top of stack', currentBinPath: 'YARD/A2',
    });
  });
});

describe('addUnits', () => {
  it('appends new slabs and pre-fills the destination', () => {
    const out = addUnits([], [A, B], 'bin-rack');
    expect(out.map((l) => [l.unitId, l.toBinId])).toEqual([['u-a', 'bin-rack'], ['u-b', 'bin-rack']]);
  });

  it('never adds the same slab twice', () => {
    const first = addUnits([], [A], '');
    const again = addUnits(first, [A, B], '');
    expect(again.map((l) => l.unitId)).toEqual(['u-a', 'u-b']);
  });

  it('does not pre-fill a destination equal to where the slab already is', () => {
    const out = addUnits([], [A], 'bin-yard');
    expect(out[0].toBinId).toBe('');
  });
});

describe('applyDestinationToAll', () => {
  it('sets every line, except a slab already sitting there', () => {
    const lines = addUnits([], [A, B], '');
    const out = applyDestinationToAll(lines, 'bin-yard');
    expect(out.map((l) => l.toBinId)).toEqual(['', 'bin-yard']);
  });

  it('does not mutate its input', () => {
    const lines = addUnits([], [B], '');
    applyDestinationToAll(lines, 'bin-rack');
    expect(lines[0].toBinId).toBe('');
  });
});

describe('toLineInputs', () => {
  it('sends only ids and notes — never a from-bin the server would ignore', () => {
    const lines = applyDestinationToAll(addUnits([], [A], ''), 'bin-rack').map((l) => ({ ...l, notes: ' keep dry ' }));
    expect(toLineInputs(lines)).toEqual([{ unitId: 'u-a', toBinId: 'bin-rack', notes: 'keep dry' }]);
  });

  it('omits empty notes', () => {
    const lines = applyDestinationToAll(addUnits([], [A], ''), 'bin-rack');
    expect(toLineInputs(lines)[0]).not.toHaveProperty('notes');
  });
});

describe('validateDraft', () => {
  const ready = applyDestinationToAll(addUnits([], [A, B], ''), 'bin-rack');

  it('passes a complete draft', () => {
    expect(validateDraft(ready, 'loc-1')).toBeNull();
  });

  it.each([
    ['no location', ready, '', /location/i],
    ['no slabs', [], 'loc-1', /at least one slab/i],
  ])('refuses %s', (_name, lines, loc, pattern) => {
    expect(validateDraft(lines, loc)).toMatch(pattern);
  });

  it('names the first line without a destination', () => {
    const lines = addUnits([], [A, B], '');
    const withFirst = [{ ...lines[0], toBinId: 'bin-rack' }, lines[1]];
    expect(validateDraft(withFirst, 'loc-1')).toBe('Line 2 (SLB-2) needs a destination bin.');
  });

  it('refuses a destination the slab is already in', () => {
    const line = { ...draftLineFromUnit(A), toBinId: 'bin-yard' };
    expect(validateDraft([line], 'loc-1')).toBe('Line 1 (SLB-1) is already in that bin.');
  });
});

describe('summarizeDraft', () => {
  it('counts slabs, adds up area and counts distinct destinations', () => {
    const lines = addUnits([], [A, B], 'bin-rack');
    lines[1] = { ...lines[1], toBinId: 'bin-other' };
    expect(summarizeDraft(lines)).toEqual({ count: 2, totalArea: 60.5, destinations: 2, areaUnitCode: 'SQFT' });
  });

  it('ignores lines that have no destination yet when counting destinations', () => {
    const lines = addUnits([], [A, B], '');
    expect(summarizeDraft(lines).destinations).toBe(0);
  });

  it('is empty for no lines', () => {
    expect(summarizeDraft([])).toEqual({ count: 0, totalArea: 0, destinations: 0, areaUnitCode: '' });
  });
});
