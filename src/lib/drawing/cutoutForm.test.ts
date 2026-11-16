import { describe, expect, it } from 'vitest';
import { MM_PER_INCH } from './constants';
import {
  cutoutPatch, defaultCutoutName, defaultDistanceLines, defaultSizeText, draftFromCutout, draftToCutout, newDraft,
} from './cutoutForm';

const IN = { unit: 'in', fractionDenominator: 32 } as const;
const CENTER = { x: 10, y: -20 };

const sinkDraft = () => newDraft('sink', 'Sink', IN);

describe('defaults', () => {
  it('names a new cutout after its type', () => {
    expect(defaultCutoutName('Sink')).toBe('Cutout - Sink');
  });

  it('measures to the left and bottom from the centre by default, nothing to top or right', () => {
    expect(defaultDistanceLines()).toEqual({ top: 'hidden', right: 'hidden', bottom: 'center', left: 'center' });
  });

  it.each([
    ['sink', '30"', '18"'],
    ['fireplace', '36"', '12"'],
    ['faucet', '1 3/8"', '1 3/8"'], // round: square at its diameter
  ] as const)('%s starts at %s x %s', (type, length, height) => {
    expect(defaultSizeText(type, IN)).toEqual({ length, height });
  });

  it('shows sizes in mm when the drawing does', () => {
    expect(defaultSizeText('sink', { unit: 'mm', fractionDenominator: 32 }).length).toBe('762mm');
  });
});

describe('draftToCutout', () => {
  it('turns the typed size into a rectangular cutout at the given centre', () => {
    const result = draftToCutout({ ...sinkDraft(), length: '23', height: '14 1/2' }, 'c1', CENTER);
    expect(result.cutout).toMatchObject({ id: 'c1', type: 'sink', shape: 'rect', center: CENTER, label: 'Cutout - Sink' });
    expect(result.cutout?.widthMm).toBeCloseTo(23 * MM_PER_INCH, 5);
    expect(result.cutout?.depthMm).toBeCloseTo(14.5 * MM_PER_INCH, 5);
  });

  it('only records the optional settings that were set', () => {
    const { cutout } = draftToCutout(sinkDraft(), 'c1', CENTER);
    expect(cutout).not.toHaveProperty('hideName');
    expect(cutout).not.toHaveProperty('hideMeasurements');
    expect(cutout).not.toHaveProperty('edgeCode');
    expect(cutout).not.toHaveProperty('faucetHoleCount');
    const withAll = draftToCutout({ ...sinkDraft(), hideName: true, hideMeasurements: true, edgeCode: 'EE', faucetHoleCount: '2' }, 'c1', CENTER).cutout;
    expect(withAll).toMatchObject({ hideName: true, hideMeasurements: true, edgeCode: 'EE', faucetHoleCount: 2 });
  });

  it('keeps faucet holes for a sink only', () => {
    const sink = draftToCutout({ ...sinkDraft(), faucetHoleCount: '1' }, 'c1', CENTER).cutout;
    expect(sink?.faucetHoleCount).toBe(1);
    expect(sink?.faucetHoleRadiusMm).toBeCloseTo(1.25 * MM_PER_INCH, 5);
    const fireplace = draftToCutout({ ...newDraft('fireplace', 'Fireplace', IN), faucetHoleCount: '1' }, 'c1', CENTER).cutout;
    expect(fireplace).not.toHaveProperty('faucetHoleCount');
    expect(fireplace).not.toHaveProperty('faucetHoleRadiusMm');
  });

  it('carries the distance lines through', () => {
    const lines = { top: 'border', right: 'center', bottom: 'hidden', left: 'border' } as const;
    expect(draftToCutout({ ...sinkDraft(), distanceLines: lines }, 'c1', CENTER).cutout?.distanceLines).toEqual(lines);
  });

  it.each([
    ['an unreadable length', { length: 'banana' }, 'length'],
    ['a zero height', { height: '0' }, 'height'],
    ['an empty length', { length: '' }, 'length'],
    ['a fractional hole count', { faucetHoleCount: '1.5' }, 'faucetHoleCount'],
    ['a negative hole count', { faucetHoleCount: '-1' }, 'faucetHoleCount'],
    ['an unreadable hole radius', { faucetHoleRadius: 'wide' }, 'faucetHoleRadius'],
    ['a negative hole radius', { faucetHoleRadius: '-1' }, 'faucetHoleRadius'],
  ] as const)('refuses %s, naming the field', (_title, change, field) => {
    const result = draftToCutout({ ...sinkDraft(), ...change }, 'c1', CENTER);
    expect(result.cutout).toBeUndefined();
    expect(result.errors?.[field]).toBeTruthy();
  });

  it('reports every bad field at once', () => {
    const result = draftToCutout({ ...sinkDraft(), length: 'x', height: 'y' }, 'c1', CENTER);
    expect(Object.keys(result.errors ?? {})).toEqual(['length', 'height']);
  });
});

/** The cutout a draft saves as; fails the test if the draft does not parse. */
function saved(...args: Parameters<typeof draftToCutout>) {
  const { cutout } = draftToCutout(...args);
  if (!cutout) throw new Error('the draft did not parse');
  return cutout;
}

describe('editing an existing cutout', () => {
  const sink = {
    id: 'c1', type: 'sink', shape: 'rect', center: CENTER, rotationDeg: 15, inventoryItemId: 'item-1',
    widthMm: 23 * MM_PER_INCH, depthMm: 14 * MM_PER_INCH, label: 'Kitchen sink', hideMeasurements: true,
    edgeCode: 'EE', faucetHoleCount: 3, faucetHoleRadiusMm: MM_PER_INCH,
    distanceLines: { top: 'border', right: 'hidden', bottom: 'center', left: 'center' },
  } as const;

  it('fills the form with what the cutout already has', () => {
    expect(draftFromCutout(sink, 'Sink', IN)).toEqual({
      type: 'sink', name: 'Kitchen sink', hideName: false, length: '23"', height: '14"', hideMeasurements: true,
      edgeCode: 'EE', faucetHoleCount: '3', faucetHoleRadius: '1"', distanceLines: sink.distanceLines,
    });
  });

  it('starts an older cutout with no name or distance lines from the defaults', () => {
    const draft = draftFromCutout({ id: 'c', type: 'faucet', shape: 'round', center: CENTER, diameterMm: 2 * MM_PER_INCH }, 'Faucet', IN);
    expect(draft).toMatchObject({ name: 'Cutout - Faucet', length: '2"', height: '2"', faucetHoleCount: '' });
    expect(draft.distanceLines).toEqual(defaultDistanceLines());
  });

  it('round-trips: saving an untouched form changes nothing the form owns', () => {
    const patch = cutoutPatch(saved(draftFromCutout(sink, 'Sink', IN), sink.id, sink.center));
    expect({ ...sink, ...patch }).toMatchObject({ ...sink, widthMm: expect.any(Number), depthMm: expect.any(Number) });
    expect(patch.widthMm).toBeCloseTo(sink.widthMm, 5);
  });

  it('clears what the form left empty, and never touches position, rotation or the inventory item', () => {
    const patch = cutoutPatch(saved({ ...draftFromCutout(sink, 'Sink', IN), edgeCode: '', hideMeasurements: false }, sink.id, sink.center));
    expect(patch).toHaveProperty('edgeCode', undefined);
    expect(patch).toHaveProperty('hideMeasurements', undefined);
    for (const kept of ['center', 'rotationDeg', 'inventoryItemId', 'id']) expect(patch).not.toHaveProperty(kept);
  });

  it('turns a round cutout into the rectangle the form describes', () => {
    const round = { id: 'c', type: 'faucet', shape: 'round', center: CENTER, diameterMm: 50 } as const;
    expect(cutoutPatch(saved(draftFromCutout(round, 'Faucet', IN), round.id, round.center))).toMatchObject({ shape: 'rect', diameterMm: undefined });
  });
});
