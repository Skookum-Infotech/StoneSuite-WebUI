import { describe, expect, it } from 'vitest';
import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { bounds } from './geometry';
import {
  autoPlace, interiorsOverlap, othersOnSlab, placedOutline, placedSize, rotatedPlacement, slabFit, slabOffset, usedSlabIds,
} from './slabs';

const SLAB = { lengthMm: 3000, widthMm: 1500 };
const SLAB_ID = 'slab-1';

// The board's world is y-up: a 600 × 400 rectangle hangs below its origin.
function rectPiece(id: string, width: number, height: number, slab?: SlabPlacement): Piece {
  return {
    id, label: id, shape: 'rect', outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -height }, { x: 0, y: -height }],
    position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [], slab,
  };
}

function lPiece(): Piece {
  return {
    ...rectPiece('L', 0, 0),
    shape: 'L',
    outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -200 }, { x: 300, y: -200 }, { x: 300, y: -400 }, { x: 0, y: -400 }],
  };
}

const at = (x: number, y: number, rotationDeg = 0): SlabPlacement => ({ slabId: SLAB_ID, x, y, rotationDeg });
const box = (outline: Point[]) => bounds(outline);

describe('placedOutline', () => {
  it('puts the top-left of the piece at the placement, flipping the board\'s y-up to slab y-down', () => {
    const b = box(placedOutline(rectPiece('A', 600, 400), at(100, 50)));
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([100, 50, 700, 450]);
  });

  it('turns a quarter clockwise about the top-left, swapping width and height', () => {
    const b = box(placedOutline(rectPiece('A', 600, 400), at(100, 50, 90)));
    expect(b.minX).toBeCloseTo(100);
    expect(b.minY).toBeCloseTo(50);
    expect(b.maxX).toBeCloseTo(500); // 400 wide now
    expect(b.maxY).toBeCloseTo(650); // 600 tall now
  });

  it('keeps an L-shape\'s notch where the drawing has it: the missing corner is bottom-right', () => {
    const outline = placedOutline(lPiece(), at(0, 0));
    // Flipped to y-down the L is a bar across the top (y 0-200) with a leg down the
    // left (x 0-300), so it has no stone in the bottom-right (x 300-600, y 200-400).
    expect(outline).toContainEqual({ x: 300, y: 200 });
    expect(outline).toContainEqual({ x: 600, y: 200 });
    expect(Math.max(...outline.map((p) => p.x))).toBe(600);
  });

  it('measures the piece once turned', () => {
    const piece = rectPiece('A', 600, 400);
    expect(placedSize(piece, 0)).toEqual({ width: 600, height: 400 });
    const turned = placedSize(piece, 90);
    expect(turned.width).toBeCloseTo(400);
    expect(turned.height).toBeCloseTo(600);
  });
});

describe('slabFit', () => {
  const outlineAt = (x: number, y: number, w = 600, h = 400) => placedOutline(rectPiece('A', w, h), at(x, y));

  it.each([
    ['well inside the slab', outlineAt(100, 100), 'fits'],
    ['flush against the slab\'s top-left corner', outlineAt(0, 0), 'fits'],
    ['flush against the slab\'s far corner', outlineAt(2400, 1100), 'fits'],
    ['hanging off the right edge', outlineAt(2500, 100), 'outside'],
    ['hanging off the top edge', outlineAt(100, -10), 'outside'],
    ['bigger than the slab', outlineAt(0, 0, 3200, 400), 'outside'],
  ])('%s', (_label, outline, expected) => {
    expect(slabFit(outline, SLAB, [])).toBe(expected);
  });

  it('does not call two pieces sitting flush against each other an overlap', () => {
    const neighbour = outlineAt(0, 0);
    expect(slabFit(outlineAt(600, 0), SLAB, [neighbour])).toBe('fits');
    expect(slabFit(outlineAt(0, 400), SLAB, [neighbour])).toBe('fits');
  });

  it('calls pieces that share stone an overlap, even when one sits wholly inside the other', () => {
    const neighbour = outlineAt(0, 0);
    expect(slabFit(outlineAt(500, 0), SLAB, [neighbour])).toBe('overlap');
    expect(slabFit(outlineAt(0, 0), SLAB, [neighbour])).toBe('overlap');
    expect(slabFit(outlineAt(100, 100, 200, 100), SLAB, [neighbour])).toBe('overlap');
  });

  it('reports off the slab ahead of overlapping', () => {
    expect(slabFit(outlineAt(2500, 100), SLAB, [outlineAt(2600, 100)])).toBe('outside');
  });

  it('fits an L-shape\'s notch around a neighbour that sits in the missing corner', () => {
    const l = placedOutline(lPiece(), at(0, 0)); // notch at x 300-600, y 200-400
    const inNotch = placedOutline(rectPiece('B', 250, 150), at(320, 220));
    expect(slabFit(inNotch, SLAB, [l])).toBe('fits');
    expect(slabFit(placedOutline(rectPiece('B', 250, 150), at(320, 150)), SLAB, [l])).toBe('overlap'); // clips the bar
  });
});

describe('interiorsOverlap', () => {
  it('is false for pieces that only touch at a corner', () => {
    const a = placedOutline(rectPiece('A', 100, 100), at(0, 0));
    const b = placedOutline(rectPiece('B', 100, 100), at(100, 100));
    expect(interiorsOverlap(a, b)).toBe(false);
  });

  it('is false for pieces far apart', () => {
    const a = placedOutline(rectPiece('A', 100, 100), at(0, 0));
    const b = placedOutline(rectPiece('B', 100, 100), at(1000, 1000));
    expect(interiorsOverlap(a, b)).toBe(false);
  });

  it('catches a thin overlap of a few millimetres', () => {
    const a = placedOutline(rectPiece('A', 100, 100), at(0, 0));
    const b = placedOutline(rectPiece('B', 100, 100), at(94, 0));
    expect(interiorsOverlap(a, b)).toBe(true);
  });
});

describe('autoPlace', () => {
  it('starts a piece in the top-left of an empty slab', () => {
    expect(autoPlace(rectPiece('A', 600, 400), SLAB_ID, SLAB, [])).toEqual(at(0, 0));
  });

  it('puts it in the first free spot, clear of what is already there', () => {
    const taken = [placedOutline(rectPiece('A', 600, 400), at(0, 0))];
    const placed = autoPlace(rectPiece('B', 600, 400), SLAB_ID, SLAB, taken);

    expect(slabFit(placedOutline(rectPiece('B', 600, 400), placed), SLAB, taken)).toBe('fits');
    expect(placed.rotationDeg).toBe(0);
    expect(placed.x).toBeGreaterThanOrEqual(600);
  });

  it('turns a piece on its side when that is the only way it fits', () => {
    // 1800 long cannot lie across a 1500-wide slab sideways... but 1700 × 200 fits as drawn,
    // and a 200 × 1700 stick only fits turned.
    const stick = rectPiece('S', 200, 1700);
    const placed = autoPlace(stick, SLAB_ID, SLAB, []);
    expect(placed.rotationDeg).toBe(90);
    expect(slabFit(placedOutline(stick, placed), SLAB, [])).toBe('fits');
  });

  it('falls back to the top-left as drawn when nothing fits, so it can be seen and dragged', () => {
    expect(autoPlace(rectPiece('Huge', 5000, 4000), SLAB_ID, SLAB, [])).toEqual(at(0, 0));
  });
});

describe('placement helpers', () => {
  it('turns a placement a quarter at a time and wraps after a full turn', () => {
    let placement = at(10, 20);
    const turns = [90, 180, 270, 0];
    for (const expected of turns) {
      placement = rotatedPlacement(placement);
      expect(placement.rotationDeg).toBe(expected);
      expect([placement.x, placement.y]).toEqual([10, 20]);
    }
  });

  it('lists the other pieces on one slab and leaves out the piece itself and pieces on other slabs', () => {
    const pieces = [
      rectPiece('A', 100, 100, at(0, 0)),
      rectPiece('B', 100, 100, at(200, 0)),
      rectPiece('C', 100, 100, { slabId: 'slab-2', x: 0, y: 0, rotationDeg: 0 }),
      rectPiece('D', 100, 100),
    ];
    expect(othersOnSlab(pieces, SLAB_ID, 'A')).toHaveLength(1);
    expect(othersOnSlab(pieces, SLAB_ID, 'Z')).toHaveLength(2);
  });

  it('counts a slab as used once any piece is on it', () => {
    const pieces = [rectPiece('A', 100, 100, at(0, 0)), rectPiece('B', 100, 100, at(200, 0)), rectPiece('D', 100, 100)];
    expect([...usedSlabIds(pieces)]).toEqual([SLAB_ID]);
    expect(usedSlabIds([rectPiece('D', 100, 100)]).size).toBe(0);
  });
});

describe('slabOffset', () => {
  // What PieceSlabTexture hands the SVG: a slab point s maps back to the piece's local
  // point as  flipY(rotate(-deg)(s - offset)). Applied to where the piece lands on the
  // slab, it must return the piece's own outline, or the photo would be drawn shifted.
  const rotate = (p: Point, deg: number): Point => {
    const rad = (deg * Math.PI) / 180;
    return { x: p.x * Math.cos(rad) - p.y * Math.sin(rad), y: p.x * Math.sin(rad) + p.y * Math.cos(rad) };
  };

  it.each([0, 90, 180, 270])("maps a piece's spot on the slab back to its own outline, turned %i degrees", (deg) => {
    for (const piece of [rectPiece('A', 600, 400), lPiece()]) {
      const placement = at(130, 70, deg);
      const offset = slabOffset(piece, placement);
      const onSlab = placedOutline(piece, placement);
      onSlab.forEach((s, i) => {
        const back = rotate({ x: s.x - offset.x, y: s.y - offset.y }, -deg);
        expect(back.x).toBeCloseTo(piece.outline[i].x);
        expect(-back.y).toBeCloseTo(piece.outline[i].y);
      });
    }
  });

  it("puts a square-on piece's corner at the placement, so the photo starts where the piece does", () => {
    expect(slabOffset(rectPiece('A', 600, 400), at(100, 50))).toEqual({ x: 100, y: 50 });
  });
});
