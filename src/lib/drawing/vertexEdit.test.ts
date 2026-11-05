import { describe, expect, it } from 'vitest';
import { area, lShapeOutline, rectOutline, uShapeOutline } from './geometry';
import { insertVertex, moveVertex, removeVertex, setEdgeLength } from './vertexEdit';
import { distance } from './geometry';

describe('setEdgeLength', () => {
  it('stretches a rectangle and keeps it a rectangle', () => {
    const out = setEdgeLength(rectOutline(1000, 600), 0, 1200);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: -600 }, { x: 0, y: -600 }]);
  });

  it('works on the vertical side and on the closing side', () => {
    expect(setEdgeLength(rectOutline(1000, 600), 1, 800)).toEqual([
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -800 }, { x: 0, y: -800 },
    ]);
    const closing = setEdgeLength(rectOutline(1000, 600), 3, 900) as ReturnType<typeof rectOutline>;
    expect(closing.map((p, i) => distance(p, closing[(i + 1) % 4]))).toEqual([1000, 900, 1000, 900]);
  });

  it('shrinks too, and can set a length to a fractional value exactly', () => {
    const out = setEdgeLength(rectOutline(1000, 600), 0, 812.8) as ReturnType<typeof rectOutline>;
    expect(distance(out[0], out[1])).toBeCloseTo(812.8, 9);
  });

  it('keeps every corner of an L square and changes only the edge the user set', () => {
    const l = lShapeOutline(1000, 600, 400, 300);
    const out = setEdgeLength(l, 0, 700) as typeof l;
    expect(distance(out[0], out[1])).toBeCloseTo(700);
    // every side stays horizontal or vertical
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length];
      expect(p.x === q.x || p.y === q.y).toBe(true);
    });
  });

  it('keeps a U square too', () => {
    const u = uShapeOutline(1500, 600, 500, 300);
    const out = setEdgeLength(u, 7, 700) as typeof u;
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length];
      expect(p.x === q.x || p.y === q.y).toBe(true);
    });
  });

  it('only moves the far corner of a non-square polygon', () => {
    const tri = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -80 }];
    const out = setEdgeLength(tri, 0, 150) as typeof tri;
    expect(out[1]).toEqual({ x: 150, y: 0 });
    expect(out[2]).toEqual(tri[2]);
  });

  it('refuses a zero-length edge', () => {
    expect(setEdgeLength([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }], 0, 10)).toBeNull();
  });
});

describe('moveVertex', () => {
  it('replaces just that corner', () => {
    const out = moveVertex(rectOutline(100, 50), 2, { x: 120, y: -60 });
    expect(out[2]).toEqual({ x: 120, y: -60 });
    expect(out[1]).toEqual({ x: 100, y: 0 });
  });
});

describe('insertVertex / removeVertex', () => {
  const edges = [{ index: 0, code: 'EE' }, { index: 2, code: 'BN' }];

  it('splits an edge at its midpoint, both halves keeping its settings and later edges shifting', () => {
    const out = insertVertex({ outline: rectOutline(1000, 600), edges }, 0);
    expect(out.outline).toHaveLength(5);
    expect(out.outline[1]).toEqual({ x: 500, y: 0 });
    expect(area(out.outline)).toBe(600000);
    expect(out.edges.map((e) => [e.index, e.code]).sort()).toEqual([[0, 'EE'], [1, 'EE'], [3, 'BN']]);
  });

  it('inserting on the closing edge appends the corner', () => {
    const out = insertVertex({ outline: rectOutline(1000, 600), edges: [] }, 3);
    expect(out.outline[4]).toEqual({ x: 0, y: -300 });
  });

  it('removing a corner joins its two sides; edge settings follow their sides', () => {
    const start = insertVertex({ outline: rectOutline(1000, 600), edges }, 0);
    const out = removeVertex(start, 1);
    expect(out.outline).toEqual(rectOutline(1000, 600));
    expect(out.edges.map((e) => [e.index, e.code]).sort()).toEqual([[0, 'EE'], [2, 'BN']]);
  });

  it('removing corner 0 keeps indices inside the new outline', () => {
    const out = removeVertex({ outline: rectOutline(1000, 600), edges: [{ index: 3, code: 'X' }, { index: 0, code: 'Y' }, { index: 1, code: 'Z' }] }, 0);
    expect(out.outline).toHaveLength(3);
    expect(out.edges.every((e) => e.index < 3)).toBe(true);
    expect(out.edges.map((e) => e.code).sort()).toEqual(['X', 'Z']);
  });
});
