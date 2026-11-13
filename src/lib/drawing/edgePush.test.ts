import { describe, expect, it } from 'vitest';
import { MM_PER_INCH } from './constants';
import { edgeNormal, pushEdge, snapToStep } from './edgePush';
import { rectOutline } from './geometry';

const SIXTEENTH = MM_PER_INCH / 16;

describe('snapToStep', () => {
  it.each([
    { value: 0, expected: 0 },
    { value: SIXTEENTH * 0.4, expected: 0 },
    { value: SIXTEENTH * 0.6, expected: SIXTEENTH },
    { value: SIXTEENTH * 7.4, expected: SIXTEENTH * 7 },
    { value: -SIXTEENTH * 2.6, expected: -SIXTEENTH * 3 },
  ])('rounds $value to the nearest sixteenth', ({ value, expected }) => {
    expect(snapToStep(value, SIXTEENTH)).toBeCloseTo(expected, 9);
  });
});

describe('edgeNormal', () => {
  const rect = rectOutline(600, 400);

  it.each([
    { name: 'top side points up', index: 0, expected: { x: 0, y: 1 } },
    { name: 'right side points right', index: 1, expected: { x: 1, y: 0 } },
    { name: 'bottom side points down', index: 2, expected: { x: 0, y: -1 } },
    { name: 'left side points left', index: 3, expected: { x: -1, y: 0 } },
  ])('$name', ({ index, expected }) => {
    const normal = edgeNormal(rect, index);
    expect(normal?.x).toBeCloseTo(expected.x, 9);
    expect(normal?.y).toBeCloseTo(expected.y, 9);
  });

  it('is null for a side with no length', () => {
    expect(edgeNormal([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }], 0)).toBeNull();
  });
});

describe('pushEdge', () => {
  const rect = rectOutline(600, 400);

  it('pulling the right side out lengthens the piece and leaves the left side alone', () => {
    const next = pushEdge(rect, 1, 50);
    expect(next.map((p) => p.x)).toEqual([0, 650, 650, 0]);
    expect(next.map((p) => p.y)).toEqual([0, 0, -400, -400]);
  });

  it('pulling the left side in shortens the piece from the left', () => {
    // Side 3 runs bottom-left -> top-left, so its normal points left (-x).
    const next = pushEdge(rect, 3, -100);
    expect(next.map((p) => p.x)).toEqual([100, 600, 600, 100]);
  });

  it('pulling the top side up deepens the piece and keeps the bottom side fixed', () => {
    const next = pushEdge(rect, 0, 25);
    expect(next.map((p) => p.y)).toEqual([25, 25, -400, -400]);
  });

  it('does not mutate the outline it was given', () => {
    const before = JSON.stringify(rect);
    pushEdge(rect, 1, 50);
    expect(JSON.stringify(rect)).toBe(before);
  });

  it('returns the outline untouched for a side with no length', () => {
    const flat = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }];
    expect(pushEdge(flat, 0, 10)).toEqual(flat);
  });
});
