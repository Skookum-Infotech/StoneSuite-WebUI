// Builds one DIMENSION entity's anonymous block: two arrowhead SOLIDs, the
// dimension line split either side of a gap sized for the text, and the
// text itself (MTEXT) — the same four-entity shape the real SPS sample
// (src/test/fixtures/dxf/SO_9073_Kitchen_P1.dxf) uses for every dimension.
// $DIMASO (associative dimensions) is on in that sample, so AutoCAD-style
// readers expect this geometry pre-rendered into the block rather than
// recomputing it from the DIMENSION entity's own definition points.

import type { Point } from '@/types/drawing';
import type { HandleAllocator} from './dxfPrimitives';
import { addPoint, pair, scalePoint } from './dxfPrimitives';
import { toReducedFraction } from './units';
import {
  ARROW_SIZE_INCHES,
  DIMENSION_TEXT_HEIGHT_INCHES,
  DXF_LAYER,
  TEXT_STYLE_NAME,
} from './constants';

export interface DimensionLine {
  /** Endpoints in drawing coordinates (inches — the unit every DXF
   *  coordinate is written in). */
  from: Point;
  to: Point;
  /** The same edge's true length in mm, used only to format the text —
   *  kept separate so rounding never leaks between the geometry and the
   *  label. */
  measurementMm: number;
  fractionDenominator: 16 | 32;
}

export interface DimensionBlock {
  name: string;
  recordHandle: string;
  blockDefinition: string;
}

/** The stacked-fraction dimension text AutoCAD renders — e.g. a 91 7/32"
 *  measurement becomes `\A1;\A1;91{\H1x;\S7/32;}"`, exactly as measured out
 *  of the real SPS sample. A whole-number measurement skips the stacked
 *  fraction (`\A1;\A1;91"`). */
function formatDimensionText(measurementMm: number, denominator: 16 | 32): string {
  const { sign, whole, numerator, denominator: den } = toReducedFraction(measurementMm, denominator);
  if (numerator === 0) return `\\A1;\\A1;${sign}${whole}"`;
  return `\\A1;\\A1;${sign}${whole}{\\H1x;\\S${numerator}/${den};}"`;
}

/** Plain character count of a dimension text string, stripping the MTEXT
 *  formatting codes — used only to size the gap the text sits in. */
function visibleLength(mtext: string): number {
  return mtext.replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}"]/g, '').length;
}

export function buildDimensionBlock(handles: HandleAllocator, dim: DimensionLine, index: number): DimensionBlock {
  const name = `*D${index}`;
  const recordHandle = handles.alloc();
  const blockBeginHandle = handles.alloc();

  const dx = dim.to.x - dim.from.x;
  const dy = dim.to.y - dim.from.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = { x: dx / length, y: dy / length };
  const perpendicular = { x: -direction.y, y: direction.x };

  const arrow1Base = addPoint(dim.from, scalePoint(direction, ARROW_SIZE_INCHES));
  const arrow2Base = addPoint(dim.to, scalePoint(direction, -ARROW_SIZE_INCHES));
  const midpoint = { x: (dim.from.x + dim.to.x) / 2, y: (dim.from.y + dim.to.y) / 2 };
  const text = formatDimensionText(dim.measurementMm, dim.fractionDenominator);
  const halfGap = Math.max(DIMENSION_TEXT_HEIGHT_INCHES * 0.3 * visibleLength(text), ARROW_SIZE_INCHES);
  const gapStart = addPoint(midpoint, scalePoint(direction, -halfGap));
  const gapEnd = addPoint(midpoint, scalePoint(direction, halfGap));

  const entityHeader = (type: string, layer: string) =>
    pair(0, type) + pair(5, handles.alloc()) + pair(330, recordHandle) + pair(100, 'AcDbEntity') + pair(8, layer);

  const arrowSolid = (tip: Point, base: Point) => {
    const halfWidth = ARROW_SIZE_INCHES / 6;
    const corner1 = addPoint(base, scalePoint(perpendicular, halfWidth));
    const corner2 = addPoint(base, scalePoint(perpendicular, -halfWidth));
    return (
      entityHeader('SOLID', DXF_LAYER.OUTLINE) + pair(62, 0) + pair(100, 'AcDbTrace') +
      pair(10, tip.x) + pair(20, tip.y) + pair(30, 0) +
      pair(11, corner1.x) + pair(21, corner1.y) + pair(31, 0) +
      pair(12, corner2.x) + pair(22, corner2.y) + pair(32, 0) +
      pair(13, corner2.x) + pair(23, corner2.y) + pair(33, 0)
    );
  };

  const dimensionLineSegment = (a: Point, b: Point) =>
    entityHeader('LINE', DXF_LAYER.OUTLINE) + pair(6, 'ByBlock') + pair(62, 0) + pair(100, 'AcDbLine') +
    pair(10, a.x) + pair(20, a.y) + pair(30, 0) + pair(11, b.x) + pair(21, b.y) + pair(31, 0);

  const mtext =
    entityHeader('MTEXT', DXF_LAYER.OUTLINE) + pair(62, 0) + pair(100, 'AcDbMText') +
    pair(10, midpoint.x) + pair(20, midpoint.y) + pair(30, 0) +
    pair(11, direction.x) + pair(21, direction.y) + pair(31, 0) +
    pair(40, DIMENSION_TEXT_HEIGHT_INCHES) + pair(41, 0) + pair(71, 5) + pair(72, 5) +
    pair(1, text) + pair(7, TEXT_STYLE_NAME);

  const blockDefinition =
    pair(0, 'BLOCK') + pair(5, blockBeginHandle) + pair(330, recordHandle) + pair(100, 'AcDbEntity') +
    pair(8, DXF_LAYER.OUTLINE) + pair(100, 'AcDbBlockBegin') + pair(2, name) + pair(70, 1) +
    pair(10, 0) + pair(20, 0) + pair(30, 0) + pair(3, name) +
    arrowSolid(dim.from, arrow1Base) +
    arrowSolid(dim.to, arrow2Base) +
    dimensionLineSegment(arrow1Base, gapStart) +
    dimensionLineSegment(gapEnd, arrow2Base) +
    mtext +
    pair(0, 'ENDBLK') + pair(5, handles.alloc()) + pair(330, recordHandle) + pair(100, 'AcDbEntity') +
    pair(8, DXF_LAYER.OUTLINE) + pair(100, 'AcDbBlockEnd');

  return { name, recordHandle, blockDefinition };
}
