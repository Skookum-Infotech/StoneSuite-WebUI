import { describe, expect, it } from 'vitest';
import type { IDimensionEntity, IPolylineEntity, ITextEntity } from 'dxf-parser';
import DxfParser from 'dxf-parser';
import type { DrawingArea } from '@/types/drawing';
import { rectOutline } from './geometry';
import { buildAreaDxf, dxfFileName } from './dxfExport';

const MM_PER_INCH = 25.4;

function singlePieceArea(lengthMm: number, widthMm: number, label: string): DrawingArea {
  return {
    id: 'area-1',
    name: 'Kitchen',
    code: 'Kitchen',
    sortOrder: 0,
    cabinets: [],
    notes: [],
    pieces: [
      {
        id: 'piece-1',
        label,
        shape: 'rect',
        outline: rectOutline(lengthMm, widthMm),
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm: 30,
        edges: [],
        seams: [],
        cutouts: [],
      },
    ],
  };
}

describe('buildAreaDxf — piece placement', () => {
  const outlineOf = (dxf: string) =>
    (new DxfParser().parseSync(dxf)?.entities.find((e) => e.type === 'POLYLINE') as IPolylineEntity).vertices;
  const meta = { orderNumber: '1', areaIndex: 1, seq: 1, fractionDenominator: 32 as const };

  it('exports a piece where it sits in the drawing, not at the origin', () => {
    const area = singlePieceArea(MM_PER_INCH * 10, MM_PER_INCH * 5, 'A-1');
    area.pieces[0].position = { x: MM_PER_INCH * 100, y: MM_PER_INCH * 20 };
    const xs = outlineOf(buildAreaDxf(area, meta)).map((v) => v.x);
    expect(Math.min(...xs)).toBeCloseTo(100, 3);
    expect(Math.max(...xs)).toBeCloseTo(110, 3);
  });

  it('applies the piece rotation, so a 90 degree piece swaps its extents', () => {
    const area = singlePieceArea(MM_PER_INCH * 10, MM_PER_INCH * 5, 'A-1');
    area.pieces[0].rotationDeg = 90;
    const vs = outlineOf(buildAreaDxf(area, meta));
    const xs = vs.map((v) => v.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(5, 3);
  });
});

describe('dxfFileName', () => {
  it.each([
    ['9073', 'Kitchen', 1, 1, 'SO_9073_Kitchen_P1_1.dxf'],
    ['9073', 'Master Bath', 2, 1, 'SO_9073_Master_Bath_P2_1.dxf'],
    ['9073', '  ', 1, 1, 'SO_9073_Area_P1_1.dxf'],
  ])('names order %s area %j as %s', (orderNumber, areaName, areaIndex, seq, expected) => {
    expect(dxfFileName(orderNumber, areaName, { areaIndex, seq })).toBe(expected);
  });
});

describe('buildAreaDxf', () => {
  // 24" x 36", a size that forces a fractional 1/32" remainder once
  // converted to mm and back, exercising the same rounding path a real
  // countertop size would.
  const LENGTH_MM = 24 * MM_PER_INCH + 25.4 / 32;
  const WIDTH_MM = 36 * MM_PER_INCH;
  const area = singlePieceArea(LENGTH_MM, WIDTH_MM, 'A-1');
  const dxfText = buildAreaDxf(area, { orderNumber: '9073', areaIndex: 1, seq: 1, fractionDenominator: 32 });

  it('parses with dxf-parser without throwing', () => {
    const parser = new DxfParser();
    expect(() => parser.parseSync(dxfText)).not.toThrow();
  });

  const parsed = new DxfParser().parseSync(dxfText);

  it('writes one closed POLYLINE with the rectangle\'s 4 corners, in inches', () => {
    const polylines = (parsed?.entities ?? []).filter((e): e is IPolylineEntity => e.type === 'POLYLINE');
    expect(polylines).toHaveLength(1);
    const [polyline] = polylines;
    expect(polyline.vertices).toHaveLength(4);
    expect(polyline.layer).toBe('0');
    const [first] = polyline.vertices;
    expect(first.x).toBeCloseTo(0, 4);
    expect(first.y).toBeCloseTo(0, 4);
    const opposite = polyline.vertices[2];
    expect(opposite.x).toBeCloseTo(LENGTH_MM / MM_PER_INCH, 4);
    expect(opposite.y).toBeCloseTo(-WIDTH_MM / MM_PER_INCH, 4);
  });

  it('labels the piece with a TEXT entity', () => {
    const texts = (parsed?.entities ?? []).filter((e): e is ITextEntity => e.type === 'TEXT');
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('A-1');
    expect(texts[0].layer).toBe('TEXT');
  });

  it('dimensions all 4 edges, each resolving an anonymous block with real geometry', () => {
    const dimensions = (parsed?.entities ?? []).filter((e): e is IDimensionEntity => e.type === 'DIMENSION');
    expect(dimensions).toHaveLength(4);
    for (const dim of dimensions) {
      expect(dim.layer).toBe('DIMENSIONS');
      const block = parsed?.blocks[dim.block as string];
      expect(block, `block ${dim.block} should exist`).toBeDefined();
      expect(block?.entities.some((e) => e.type === 'MTEXT')).toBe(true);
      expect(block?.entities.filter((e) => e.type === 'SOLID')).toHaveLength(2);
      expect(block?.entities.filter((e) => e.type === 'LINE')).toHaveLength(2);
    }
  });

  it('writes the length edge\'s dimension text as a reduced 1/32" stacked fraction', () => {
    const dimensions = (parsed?.entities ?? []).filter((e): e is IDimensionEntity => e.type === 'DIMENSION');
    const lengthDim = dimensions.find((d) => {
      const { linearOrAngularPoint1: p1, linearOrAngularPoint2: p2 } = d;
      if (!p1 || !p2) return false;
      return Math.abs(p2.x - p1.x) > 1;
    });
    const block = parsed?.blocks[lengthDim?.block as string];
    const mtext = block?.entities.find((e) => e.type === 'MTEXT') as { text?: string } | undefined;
    expect(mtext?.text).toContain('24{\\H1x;\\S1/32;}"');
  });
});
