import { describe, expect, it } from 'vitest';
import type { Cutout } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import {
  buildShapeDrawing, findShape, shapeSizeMm, shapesForTab, shapesForType, SINK_SHAPES, tabOfGeometry, tabsForType,
} from './cutoutShapes';

const NAMES = [
  'Farmhouse', 'Double bowl 60/40', 'Double bowl 70/30', 'Double bowl rectangle', 'Double bowl', 'Bar',
  'Single bowl rectangle', 'Vanity', 'Rectangle', 'Single bowl, right drainboard',
  'Single bowl, right drainboard (grooved)', 'Single bowl, wide drainboard', 'Single bowl, left drainboard',
];

const ALL = (['sink', 'cooktop', 'fireplace', 'bathtub'] as const).flatMap((type) => shapesForType(type));

const cutoutOf = (code: string, change: Partial<Cutout> = {}): Cutout => ({
  id: 'c', type: 'sink', shape: 'rect', center: { x: 1000, y: -500 }, widthMm: 800, depthMm: 400, shapeCode: code, ...change,
});

describe('the sink shape library', () => {
  it('has the twenty shapes, the first thirteen named in the order given', () => {
    expect(SINK_SHAPES).toHaveLength(20);
    expect(SINK_SHAPES.slice(0, NAMES.length).map((s) => s.name)).toEqual(NAMES);
  });

  it('gives every shape its own code, all in the sink family', () => {
    const codes = SINK_SHAPES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^sink\.[a-z0-9-]+$/);
  });

  it('offers its pictures per type: sinks, a cooktop, two fireplaces, two bathtubs — none for faucet or other', () => {
    expect(shapesForType('sink')).toBe(SINK_SHAPES);
    expect(shapesForType('cooktop').map((s) => s.name)).toEqual(['Rectangle']);
    expect(shapesForType('fireplace').map((s) => s.name)).toEqual(['Arc', 'Rectangle']);
    expect(shapesForType('bathtub').map((s) => s.name)).toEqual(['Oval', 'Rectangle']);
    expect(shapesForType('faucet')).toEqual([]);
    expect(shapesForType('other')).toEqual([]);
  });

  it('gives each type its outline tabs, in order', () => {
    expect(tabsForType('sink')).toEqual(['rectangle']);
    expect(tabsForType('cooktop')).toEqual(['rectangle']);
    expect(tabsForType('fireplace')).toEqual(['arc', 'rectangle']);
    expect(tabsForType('bathtub')).toEqual(['ellipse', 'rectangle']);
    expect(tabsForType('other')).toEqual(['arc', 'rectangle', 'ellipse']);
    expect(tabsForType('faucet')).toEqual([]);
  });

  it('files each picture under the tab whose outline it sits in', () => {
    expect(shapesForTab('fireplace', 'arc').map((s) => [s.code, s.geometry])).toEqual([['fireplace.arc', 'arc']]);
    expect(shapesForTab('fireplace', 'rectangle').map((s) => [s.code, s.geometry])).toEqual([['fireplace.rectangle', 'rect']]);
    // The Oval is a rounded-ends outline, under the Ellipse tab.
    expect(shapesForTab('bathtub', 'ellipse').map((s) => [s.code, s.geometry])).toEqual([['bathtub.oval', 'stadium']]);
    expect(shapesForTab('bathtub', 'rectangle').map((s) => s.code)).toEqual(['bathtub.rectangle']);
    expect(shapesForTab('other', 'arc')).toEqual([]);
  });

  it('puts an opening of any outline under its tab', () => {
    expect(tabOfGeometry('arc')).toBe('arc');
    expect(tabOfGeometry('ellipse')).toBe('ellipse');
    expect(tabOfGeometry('stadium')).toBe('ellipse');
    expect(tabOfGeometry('rect')).toBe('rectangle');
    expect(tabOfGeometry(undefined)).toBe('rectangle');
  });

  it('draws the cooktop as a rim with five burners (three rings each) and three small dots', () => {
    const drawing = buildShapeDrawing(cutoutOf('cooktop.rectangle', { type: 'cooktop' }));
    expect(drawing?.paths).toHaveLength(1);
    expect(drawing?.circles).toHaveLength(5 * 3 + 3);
  });

  it('draws the flame as curves, the same for the arc and the rectangle fireplace', () => {
    const arc = buildShapeDrawing(cutoutOf('fireplace.arc', { type: 'fireplace' }));
    const rectangle = buildShapeDrawing(cutoutOf('fireplace.rectangle', { type: 'fireplace' }));
    expect(arc?.paths).toHaveLength(2);
    expect(arc?.paths[0]).toMatch(/^M .* C .* Z$/);
    expect(rectangle?.paths).toHaveLength(3); // the same flame, plus the rectangle's rim
    expect(rectangle?.paths.slice(1)).toEqual(arc?.paths);
  });

  it('draws a bathtub drain as a ring with a plus in it', () => {
    const drawing = buildShapeDrawing(cutoutOf('bathtub.rectangle', { type: 'bathtub' }));
    expect(drawing?.circles).toHaveLength(1);
    expect(drawing?.lines).toHaveLength(2);
  });

  it('finds a shape by code, and nothing for an unknown or empty one', () => {
    expect(findShape('sink.farmhouse')?.name).toBe('Farmhouse');
    expect(findShape('sink.nope')).toBeUndefined();
    expect(findShape('')).toBeUndefined();
    expect(findShape(undefined)).toBeUndefined();
  });

  it('starts a shape at its typical size', () => {
    const farmhouse = findShape('sink.farmhouse');
    expect(farmhouse && shapeSizeMm(farmhouse).lengthMm).toBeCloseTo(36 * MM_PER_INCH, 5);
  });

  it.each(ALL.map((s) => [s.code, s] as const))('%s stays inside its own rectangle', (_code, shape) => {
    for (const part of shape.parts) {
      let points: Array<[number, number]>;
      if (part.k === 'poly') points = part.pts;
      else if (part.k === 'circle' || part.k === 'plus') points = [part.at];
      else if (part.k === 'line') points = [part.a, part.b];
      else points = part.segs.flatMap((seg) => (seg[0] === 'Z' ? [] : seg.slice(1) as Array<[number, number]>));
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('draws a left drainboard as the mirror of the right one', () => {
    const right = buildShapeDrawing(cutoutOf('sink.single-bowl-right-drainboard'));
    const left = buildShapeDrawing(cutoutOf('sink.single-bowl-left-drainboard'));
    // Cutout centre x is 1000: a point at 1000 + d on one side is at 1000 - d on the other.
    expect(left?.circles[0].cx).toBeCloseTo(2000 - (right?.circles[0].cx ?? 0), 2);
    expect(left?.circles[0].cy).toBe(right?.circles[0].cy);
  });
});

describe('buildShapeDrawing', () => {
  it('has nothing to draw for No Picture, an unknown shape, or a cutout with no size', () => {
    expect(buildShapeDrawing(cutoutOf(''))).toBeNull();
    expect(buildShapeDrawing(cutoutOf('sink.nope'))).toBeNull();
    expect(buildShapeDrawing(cutoutOf('sink.farmhouse', { widthMm: 0 }))).toBeNull();
  });

  it('draws the farmhouse as a rim, an apron, two crossing lines and a drain', () => {
    const drawing = buildShapeDrawing(cutoutOf('sink.farmhouse'));
    expect(drawing?.paths).toHaveLength(2);
    expect(drawing?.lines).toHaveLength(2);
    expect(drawing?.circles).toHaveLength(1);
  });

  it('puts the drain of a centred bowl on the cutout centre (y up: just above it)', () => {
    const [drain] = buildShapeDrawing(cutoutOf('sink.double-bowl-60-40'))?.circles ?? [];
    expect(drain.cx).toBeLessThan(1000); // the left bowl
    expect(drain.cy).toBeCloseTo(-500 + 0.01 * 400, 1); // drain row sits at 0.49 down the height
  });

  it('keeps drains round whatever the cutout is stretched to', () => {
    const wide = buildShapeDrawing(cutoutOf('sink.double-bowl', { widthMm: 1600, depthMm: 400 }));
    const tall = buildShapeDrawing(cutoutOf('sink.double-bowl', { widthMm: 400, depthMm: 400 }));
    expect(wide?.circles[0].r).toBe(tall?.circles[0].r); // radius follows the shorter side only
  });

  it('turns the whole picture with the cutout', () => {
    const flat = buildShapeDrawing(cutoutOf('sink.single-bowl-right-drainboard'));
    const turned = buildShapeDrawing(cutoutOf('sink.single-bowl-right-drainboard', { rotationDeg: 90 }));
    const [a] = flat?.lines ?? [];
    const [b] = turned?.lines ?? [];
    // A flat drainboard line becomes upright, still a line of the same length.
    expect(Math.hypot(a.x2 - a.x1, a.y2 - a.y1)).toBeCloseTo(Math.hypot(b.x2 - b.x1, b.y2 - b.y1), 2);
    expect(Math.abs(b.x2 - b.x1)).toBeLessThan(0.01);
  });

  it('draws round corners as curves and the 60/40 rim with its step', () => {
    const [rim] = buildShapeDrawing(cutoutOf('sink.double-bowl-60-40'))?.paths ?? [];
    expect(rim.match(/Q/g)).toHaveLength(6); // one curve per corner of the stepped outline
    expect(rim.startsWith('M ')).toBe(true);
    expect(rim.endsWith('Z')).toBe(true);
  });

  it('uses the cutout size only, so a round cutout draws no picture it cannot size', () => {
    expect(buildShapeDrawing(cutoutOf('sink.farmhouse', { shape: 'round', widthMm: undefined, depthMm: undefined, diameterMm: 300 }))?.paths).toHaveLength(2);
  });
});
