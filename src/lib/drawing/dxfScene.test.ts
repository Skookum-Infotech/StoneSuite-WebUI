import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDxfScene, DxfTooComplexError, DxfUnreadableError, type DxfScene } from './dxfScene';

const FIXTURE_PATH = join(import.meta.dirname, '..', '..', 'test', 'fixtures', 'dxf', 'SO_9073_Kitchen_P1.dxf');
const fixture = readFileSync(FIXTURE_PATH, 'utf8');

/** A minimal, valid DXF: pass the ENTITIES (and optionally BLOCKS) as raw group pairs. */
function dxf(entities: string[], blocks: string[] = []): string {
  return [
    '0', 'SECTION', '2', 'BLOCKS', ...blocks, '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');
}

const line = (x1: number, y1: number, x2: number, y2: number, layer = '0') => [
  '0', 'LINE', '8', layer, '10', String(x1), '20', String(y1), '30', '0', '11', String(x2), '21', String(y2), '31', '0',
];

/** Parses a path's `d` into its subpaths' points, for asserting geometry. */
function subpaths(d: string): Array<Array<[number, number]>> {
  return d.split('M').filter(Boolean).map((part) => part.replace(/Z/g, '').trim().split('L').map((pt) => {
    const [x, y] = pt.trim().split(' ').map(Number);
    return [x, y] as [number, number];
  }));
}

function strokePaths(scene: DxfScene) {
  return scene.paths.filter((p) => !p.filled).flatMap((p) => subpaths(p.d));
}

describe('buildDxfScene on a real SPS export', () => {
  const scene = buildDxfScene(fixture);

  it('draws every outline, cabinet line and dimension', () => {
    // 6 piece POLYLINEs + 30 CABINETS LINEs + 2 dimension-line LINEs per *Dn block.
    expect(strokePaths(scene)).toHaveLength(6 + 30 + 10 * 2);
    // 2 arrowhead SOLIDs per *Dn block.
    expect(scene.paths.filter((p) => p.filled).flatMap((p) => subpaths(p.d))).toHaveLength(10 * 2);
  });

  it('shows the stacked-fraction dimension text as readers expect it', () => {
    expect(scene.texts.map((t) => t.text)).toContain('91 7/32"');
  });

  it('keeps every note and label', () => {
    // 20 TEXT entities + 1 MTEXT per dimension block.
    expect(scene.texts).toHaveLength(20 + 10);
  });

  it('draws cabinets dashed, as the file says', () => {
    expect(scene.paths.find((p) => p.dashed)).toBeDefined();
    expect(subpaths(scene.paths.find((p) => p.dashed)?.d ?? '')).toHaveLength(30);
  });

  it('reports nothing as unsupported — this file is fully drawn', () => {
    expect(scene.unsupported).toEqual({});
  });

  // Stated in the file's own header; our bounds must land inside them, flipped
  // because SVG y points down. ($EXTMAX y = 30.009 → screen minY ≈ -30.)
  it('fits within the extents the file declares', () => {
    expect(scene.bounds.minX).toBeGreaterThanOrEqual(267.9);
    expect(scene.bounds.maxX).toBeLessThanOrEqual(400);
    expect(scene.bounds.minY).toBeGreaterThanOrEqual(-30.1);
    expect(scene.bounds.maxY).toBeLessThanOrEqual(104.2);
  });
});

describe('buildDxfScene geometry', () => {
  it('flips y, because DXF y points up and SVG y points down', () => {
    const scene = buildDxfScene(dxf(line(1, 2, 3, 4)));
    expect(strokePaths(scene)).toEqual([[[1, -2], [3, -4]]]);
  });

  it('closes a closed LWPOLYLINE', () => {
    const scene = buildDxfScene(dxf([
      '0', 'LWPOLYLINE', '8', '0', '90', '3', '70', '1',
      '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '10',
    ]));
    expect(scene.paths[0].d).toMatch(/Z/);
  });

  it('turns a bulged polyline segment into a real arc', () => {
    // Bulge 1 = a semicircle from (0,0) to (10,0); it bows to y = -5 going CCW.
    const scene = buildDxfScene(dxf([
      '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
      '10', '0', '20', '0', '42', '1', '10', '10', '20', '0',
    ]));
    const points = strokePaths(scene)[0];
    expect(points.length).toBeGreaterThan(10);
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)?.[0]).toBeCloseTo(10, 3);
    // Screen y is flipped, so the bow at world y = -5 shows at screen y = +5.
    expect(Math.max(...points.map(([, y]) => y))).toBeCloseTo(5, 1);
  });

  it('draws a full CIRCLE that returns to its start', () => {
    const scene = buildDxfScene(dxf(['0', 'CIRCLE', '8', '0', '10', '5', '20', '5', '30', '0', '40', '2']));
    expect(scene.bounds.minX).toBeCloseTo(3, 2);
    expect(scene.bounds.maxX).toBeCloseTo(7, 2);
    const points = strokePaths(scene)[0];
    expect(points[0][0]).toBeCloseTo(points.at(-1)?.[0] ?? NaN, 3);
  });

  it('sweeps an ARC counter-clockwise from start to end, across 0°', () => {
    // 270° → 90° through 0°: the right-hand half of the circle only.
    const scene = buildDxfScene(dxf(['0', 'ARC', '8', '0', '10', '0', '20', '0', '30', '0', '40', '10', '50', '270', '51', '90']));
    expect(scene.bounds.maxX).toBeCloseTo(10, 2);
    expect(scene.bounds.minX).toBeCloseTo(0, 2);
  });

  // A mirrored AutoCAD arc is stored with extrusion z = -1: a corner in a
  // countertop outline would otherwise land on the wrong side of the piece.
  it('mirrors an ARC whose extrusion points down', () => {
    const scene = buildDxfScene(dxf(['0', 'ARC', '8', '0', '10', '20', '20', '0', '30', '0', '40', '10', '50', '270', '51', '90', '230', '-1']));
    expect(scene.bounds.minX).toBeCloseTo(-30, 2);
    expect(scene.bounds.maxX).toBeCloseTo(-20, 2);
  });

  it('places an INSERT with its scale, rotation and position', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'B', '10', '100', '20', '0', '30', '0', '41', '2', '42', '2', '50', '90'],
      ['0', 'BLOCK', '8', '0', '2', 'B', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'B', ...line(1, 0, 2, 0), '0', 'ENDBLK'],
    ));
    const [[start, end]] = strokePaths(scene);
    expect(start[0]).toBeCloseTo(100, 3);
    expect(start[1]).toBeCloseTo(-2, 3);
    expect(end[1]).toBeCloseTo(-4, 3);
  });

  it('draws the block a DIMENSION points at', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'DIMENSION', '8', 'DIMENSIONS', '2', '*D0', '70', '1'],
      ['0', 'BLOCK', '8', '0', '2', '*D0', '70', '1', '10', '0', '20', '0', '30', '0', '3', '*D0', ...line(0, 0, 5, 0), '0', 'ENDBLK'],
    ));
    expect(strokePaths(scene)).toEqual([[[0, 0], [5, 0]]]);
  });

  it('anchors a centred TEXT at its alignment point', () => {
    const scene = buildDxfScene(dxf([
      '0', 'TEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '2', '1', 'Sink', '72', '1',
      '11', '50', '21', '60', '31', '0',
    ]));
    expect(scene.texts[0]).toMatchObject({ text: 'Sink', x: 50, y: -60, anchor: 'middle', height: 2 });
  });

  it('splits a multi-line MTEXT into stacked lines going down the screen', () => {
    const scene = buildDxfScene(dxf([
      '0', 'MTEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '2', '71', '1', '1', 'One\\PTwo',
    ]));
    expect(scene.texts.map((t) => t.text)).toEqual(['One', 'Two']);
    expect(scene.texts[1].y).toBeGreaterThan(scene.texts[0].y);
  });

  it('takes an MTEXT direction vector over its rotation', () => {
    const scene = buildDxfScene(dxf([
      '0', 'MTEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '2', '71', '5', '1', 'Up', '11', '0', '21', '1', '31', '0',
    ]));
    expect(scene.texts[0].rotationDeg).toBeCloseTo(90, 3);
    expect(scene.texts[0]).toMatchObject({ anchor: 'middle', baseline: 'middle' });
  });
});

describe('buildDxfScene: what is left out', () => {
  it('hides DEFPOINTS, which CAD programs never print', () => {
    const scene = buildDxfScene(dxf(line(0, 0, 1, 1, 'DEFPOINTS')));
    expect(scene.paths).toEqual([]);
    expect(scene.unsupported).toEqual({});
  });

  it('hides layers the file has turned off', () => {
    const withLayerTable = [
      '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '1',
      '0', 'LAYER', '2', 'OFF', '70', '0', '62', '-7', '6', 'Continuous',
      '0', 'ENDTAB', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES', ...line(0, 0, 1, 1, 'OFF'), ...line(2, 2, 3, 3, 'ON'), '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');
    expect(strokePaths(buildDxfScene(withLayerTable))).toHaveLength(1);
  });

  it('counts what it cannot draw instead of dropping it silently', () => {
    const scene = buildDxfScene(dxf([
      ...line(0, 0, 1, 1),
      '0', 'SPLINE', '8', '0', '70', '8', '71', '3', '72', '0', '73', '0', '74', '0',
      '0', 'SPLINE', '8', '0', '70', '8', '71', '3', '72', '0', '73', '0', '74', '0',
    ]));
    expect(scene.unsupported).toEqual({ SPLINE: 2 });
  });

  // dxf-parser skips types it doesn't know, so the scene never sees these.
  it('counts entity types the parser itself drops', () => {
    const scene = buildDxfScene(dxf([...line(0, 0, 1, 1), '0', 'HATCH', '8', '0', '2', 'SOLID', '70', '1']));
    expect(scene.unsupported).toEqual({ HATCH: 1 });
    expect(strokePaths(scene)).toHaveLength(1);
  });

  it('counts an INSERT of a block that does not exist', () => {
    const scene = buildDxfScene(dxf(['0', 'INSERT', '8', '0', '2', 'GONE', '10', '0', '20', '0', '30', '0']));
    expect(scene.unsupported).toEqual({ 'INSERT (missing block)': 1 });
  });

  it('survives a block that inserts itself', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'LOOP', '10', '0', '20', '0', '30', '0'],
      ['0', 'BLOCK', '8', '0', '2', 'LOOP', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'LOOP',
        ...line(0, 0, 1, 1), '0', 'INSERT', '8', '0', '2', 'LOOP', '10', '0', '20', '0', '30', '0', '0', 'ENDBLK'],
    ));
    expect(strokePaths(scene)).toHaveLength(1);
  });

  // Nested arrays multiply: a tiny file can describe billions of shapes.
  it('refuses a small file that expands past the limit', () => {
    const array = (name: string, inner: string) => [
      '0', 'BLOCK', '8', '0', '2', name, '70', '0', '10', '0', '20', '0', '30', '0', '3', name,
      '0', 'INSERT', '8', '0', '2', inner, '10', '0', '20', '0', '30', '0', '70', '1000', '71', '1000', '44', '1', '45', '1',
      '0', 'ENDBLK',
    ];
    const text = dxf(
      ['0', 'INSERT', '8', '0', '2', 'A', '10', '0', '20', '0', '30', '0'],
      [...array('A', 'B'), '0', 'BLOCK', '8', '0', '2', 'B', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'B', ...line(0, 0, 1, 1), '0', 'ENDBLK'],
    );
    expect(() => buildDxfScene(text)).toThrow(DxfTooComplexError);
  });
});

describe('buildDxfScene: review findings', () => {
  const blockB = ['0', 'BLOCK', '8', '0', '2', 'B', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'B', ...line(0, 0, 1, 1), '0', 'ENDBLK'];

  // All shapes of one style share a `d`, and SVG stops at the first bad token:
  // one NaN would erase every shape drawn after it.
  it.each([['abc'], ['1e999']])('keeps a bad INSERT scale (%s) from blanking the rest of the drawing', (scale) => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'B', '10', '0', '20', '0', '30', '0', '41', scale, ...line(5, 5, 6, 6)],
      blockB,
    ));
    const all = scene.paths.map((p) => p.d).join('');
    expect(all).not.toMatch(/NaN|Infinity/);
    expect(strokePaths(scene)).toEqual([[[5, -5], [6, -6]]]);
    expect(scene.unsupported).toEqual({ LINE: 1 });
    expect(scene.bounds.maxX).toBe(6);
  });

  it('counts a text whose placement is not a real number', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'T', '10', '0', '20', '0', '30', '0', '41', 'abc'],
      ['0', 'BLOCK', '8', '0', '2', 'T', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'T',
        '0', 'TEXT', '8', '0', '10', '1', '20', '1', '30', '0', '40', '2', '1', 'Sink', '0', 'ENDBLK'],
    ));
    expect(scene.texts).toEqual([]);
    expect(scene.unsupported).toEqual({ TEXT: 1 });
  });

  it.each([
    ['ARC missing its angles', ['0', 'ARC', '8', '0', '10', '0', '20', '0', '30', '0', '40', '5'], 'ARC'],
    ['CIRCLE missing its centre', ['0', 'CIRCLE', '8', '0', '40', '2'], 'CIRCLE'],
    ['one-vertex LWPOLYLINE', ['0', 'LWPOLYLINE', '8', '0', '90', '1', '70', '0', '10', '0', '20', '0'], 'LWPOLYLINE'],
    ['INSERT with no position', ['0', 'INSERT', '8', '0', '2', 'GONE'], 'INSERT'],
  ])('counts a %s instead of dropping it silently', (_name, entity, type) => {
    expect(buildDxfScene(dxf(entity as string[])).unsupported[type]).toBe(1);
  });

  it('counts unknown types inside a block that gets drawn', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'H', '10', '0', '20', '0', '30', '0'],
      ['0', 'BLOCK', '8', '0', '2', 'H', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'H',
        '0', 'HATCH', '8', '0', '2', 'SOLID', '0', 'ENDBLK'],
    ));
    expect(scene.unsupported).toEqual({ HATCH: 1 });
  });

  it('does not report a block nobody draws', () => {
    const scene = buildDxfScene(dxf(
      line(0, 0, 1, 1),
      ['0', 'BLOCK', '8', '0', '2', 'H', '70', '0', '10', '0', '20', '0', '30', '0', '3', 'H',
        '0', 'HATCH', '8', '0', '2', 'SOLID', '0', 'ENDBLK'],
    ));
    expect(scene.unsupported).toEqual({});
  });

  it('counts unknown types in a file with CR-only line endings', () => {
    const text = dxf([...line(0, 0, 1, 1), '0', 'HATCH', '8', '0', '2', 'SOLID']).replace(/\n/g, '\r');
    expect(buildDxfScene(text).unsupported).toEqual({ HATCH: 1 });
  });

  // Saved AutoCAD files carry these; they aren't missing content.
  it.each([
    ['a VIEWPORT', ['0', 'VIEWPORT', '8', '0', '67', '1']],
    ['a paper-space HATCH', ['0', 'HATCH', '8', '0', '67', '1', '2', 'SOLID']],
    ['a HATCH on a hidden layer', ['0', 'HATCH', '8', 'DEFPOINTS', '2', 'SOLID']],
  ])('does not claim %s is missing from the drawing', (_name, entity) => {
    expect(buildDxfScene(dxf([...line(0, 0, 1, 1), ...entity])).unsupported).toEqual({});
  });

  // A mirrored faucet hole has to stay with its mirrored outline.
  it('mirrors a CIRCLE whose extrusion points down', () => {
    const scene = buildDxfScene(dxf(['0', 'CIRCLE', '8', '0', '10', '10', '20', '0', '30', '0', '40', '2', '230', '-1']));
    expect(scene.bounds.minX).toBeCloseTo(-12, 2);
    expect(scene.bounds.maxX).toBeCloseTo(-8, 2);
  });

  it('still hides a CIRCLE on a hidden layer or in paper space', () => {
    expect(buildDxfScene(dxf(['0', 'CIRCLE', '8', 'DEFPOINTS', '10', '0', '20', '0', '30', '0', '40', '2'])).paths).toEqual([]);
    expect(buildDxfScene(dxf(['0', 'CIRCLE', '8', '0', '67', '1', '10', '0', '20', '0', '30', '0', '40', '2'])).paths).toEqual([]);
  });

  it('dashes a CIRCLE drawn with a dashed linetype', () => {
    const scene = buildDxfScene(dxf(['0', 'CIRCLE', '8', '0', '6', 'DASHED', '10', '0', '20', '0', '30', '0', '40', '2']));
    expect(scene.paths[0].dashed).toBe(true);
  });

  it('mirrors a SOLID whose extrusion points down', () => {
    const scene = buildDxfScene(dxf([
      '0', 'SOLID', '8', '0', '10', '10', '20', '0', '30', '0', '11', '12', '21', '0', '31', '0', '12', '10', '22', '2', '32', '0', '210', '0', '220', '0', '230', '-1',
    ]));
    expect(scene.bounds.minX).toBeCloseTo(-12, 2);
    expect(scene.bounds.maxX).toBeCloseTo(-10, 2);
  });

  it('refuses more text than a page can hold', () => {
    const texts = Array.from({ length: 20_001 }, () => ['0', 'TEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '1', '1', 'x']).flat();
    expect(() => buildDxfScene(dxf(texts))).toThrow(DxfTooComplexError);
  });

  it('shortens a single enormous text', () => {
    const scene = buildDxfScene(dxf(['0', 'TEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '1', '1', 'x'.repeat(50_000)]));
    expect(scene.texts[0].text.length).toBeLessThan(2_100);
    expect(scene.texts[0].text.endsWith('…')).toBe(true);
  });

  // The group 50 of an MTEXT is degrees in real files, whatever the reference says.
  it('reads an MTEXT rotation with no direction vector as degrees', () => {
    const scene = buildDxfScene(dxf(['0', 'MTEXT', '8', '0', '10', '0', '20', '0', '30', '0', '40', '2', '71', '1', '50', '90', '1', 'Up']));
    expect(scene.texts[0].rotationDeg).toBeCloseTo(90, 3);
  });

  it.each([[3], [5]])('starts Aligned/Fit TEXT (halign %i) at its first point, not its second', (halign) => {
    const scene = buildDxfScene(dxf([
      '0', 'TEXT', '8', '0', '10', '1', '20', '2', '30', '0', '40', '2', '1', 'Note', '72', String(halign), '11', '50', '21', '60', '31', '0',
    ]));
    expect(scene.texts[0]).toMatchObject({ x: 1, y: -2, anchor: 'start' });
  });

  // CAD spaces an array in the block's placed units: spacing isn't scaled.
  it('does not scale the spacing of an INSERT array', () => {
    const scene = buildDxfScene(dxf(
      ['0', 'INSERT', '8', '0', '2', 'B', '10', '0', '20', '0', '30', '0', '41', '2', '42', '2', '70', '2', '44', '10'],
      blockB,
    ));
    expect(strokePaths(scene).map((points) => points[0][0])).toEqual([0, 10]);
  });
});

describe('buildDxfScene: bad files', () => {
  it.each([
    ['not a DXF at all', 'hello world'],
    ['binary DXF', 'AutoCAD Binary DXF\r\n\x1a\x00'],
    ['empty', ''],
  ])('rejects %s as unreadable', (_name, text) => {
    expect(() => buildDxfScene(text)).toThrow(DxfUnreadableError);
  });

  it('gives an empty drawing no bounds rather than NaN', () => {
    const scene = buildDxfScene(dxf([]));
    expect(scene.paths).toEqual([]);
    expect(scene.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('skips an entity with missing coordinates instead of drawing NaN', () => {
    const scene = buildDxfScene(dxf(['0', 'CIRCLE', '8', '0', '40', '2', ...line(0, 0, 1, 1)]));
    expect(scene.paths.every((p) => !p.d.includes('NaN'))).toBe(true);
    expect(strokePaths(scene)).toHaveLength(1);
  });
});
