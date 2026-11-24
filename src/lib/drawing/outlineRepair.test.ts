import { describe, expect, it } from 'vitest';
import { isClockwise, rectOutline } from './geometry';
import { dragSideOutline } from './edgePush';
import { applyRect, repairOutline } from './outlineRepair';
import { validateOutline } from './validation';

describe('repairOutline', () => {
  it('leaves a clockwise simple outline alone', () => {
    const rect = rectOutline(600, 400);
    expect(repairOutline(rect)).toBe(rect);
  });

  it('winds a flipped (counter-clockwise) outline back the right way round', () => {
    const flipped = [...rectOutline(600, 400)].reverse();
    expect(isClockwise(flipped)).toBe(false);
    const fixed = repairOutline(flipped);
    expect(isClockwise(fixed)).toBe(true);
    expect(validateOutline(fixed)).toEqual([]);
  });

  it('leaves a loop whose sides cross alone, for validation to refuse', () => {
    // A bowtie: two triangles touching at one point.
    const bowtie = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
    expect(repairOutline(bowtie)).toBe(bowtie);
  });
});

describe('a side dragged across the others', () => {
  const LEG = 600;
  const rect = rectOutline(600, 400);

  it('the right side dragged past the left flips the box and shows it as a proper box', () => {
    // Right side normal is +x: -800 carries it to x = -200, past the left side.
    const { outline } = dragSideOutline(rect, 1, -800, 0, LEG);
    expect(isClockwise(outline)).toBe(true);
    expect(validateOutline(outline)).toEqual([]);
    expect(outline.map((p) => p.x).sort((a, b) => a - b)).toEqual([-200, -200, 0, 0]);
  });

  it('a leg end carried down through the whole run cuts away what it swept over', () => {
    const run = rectOutline(2000, 600);
    const withLeg = dragSideOutline(run, 1, 0, -400, LEG).outline;
    // Leg end (side 2) from y = 400 down to y = -700, past the run's bottom.
    const { outline } = dragSideOutline(withLeg, 2, -1100, 0, LEG);
    expect(validateOutline(outline)).toEqual([]);
    expect(isClockwise(outline)).toBe(true);
    expect(outline.map((p) => p.x).sort((a, b) => a - b)).toEqual([0, 0, 1400, 1400]);
    expect(outline.map((p) => p.y).sort((a, b) => a - b)).toEqual([-600, -600, 0, 0]);
  });
});

describe('applyRect', () => {
  const rect = rectOutline(600, 400);

  it('adding a rectangle that overlaps the shape gives one outline of both', () => {
    const merged = applyRect(rect, { x: 300, y: -100 }, { x: 900, y: -200 }, 'add');
    expect(merged).toHaveLength(8);
    expect(validateOutline(merged ?? [])).toEqual([]);
  });

  it('cutting a rectangle out of a corner leaves an L', () => {
    const cut = applyRect(rect, { x: 400, y: -200 }, { x: 900, y: -500 }, 'cut');
    expect(cut).toHaveLength(6);
    expect(validateOutline(cut ?? [])).toEqual([]);
  });

  it('is null when the result would have a hole in it or fall apart', () => {
    expect(applyRect(rect, { x: 200, y: -100 }, { x: 400, y: -300 }, 'cut')).toBeNull();
    expect(applyRect(rect, { x: -10, y: -500 }, { x: 610, y: 50 }, 'cut')).toBeNull();
  });

  it('is null for a shape that is not square-cornered', () => {
    const slanted = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }];
    expect(applyRect(slanted, { x: 0, y: 0 }, { x: 5, y: -5 }, 'add')).toBeNull();
  });
});
