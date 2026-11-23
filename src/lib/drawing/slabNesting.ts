// Packing a drawing's pieces — and its profile pieces, which are stone too — onto
// slabs. Two questions, one method:
//  - estimateSlabs: how many slabs of one size the whole drawing needs, packing
//    onto as many virtual slabs as it takes (the "Slabs required" figure);
//  - nestOnSlabs: lay everything not yet on a slab onto the slabs the order
//    actually holds (the Material tab's "Nest all").
// Both place biggest first, each at the first spot that fits (slabs.ts), turning a
// piece a quarter turn when that helps. That is a quick, repeatable estimate, not an
// optimal cutting plan: grain, kerf and the saw's own limits are not modelled.

import type { Point, SlabPlacement } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import { bounds } from './geometry';
import type { SlabPlaceable } from './slabPlaceables';
import { firstFitPlacement, placedOutline, placedSize, slabFit, type SlabSize } from './slabs';

/** A jumbo slab, 126" x 63": what the estimate assumes until the order holds a slab of its own. */
export const DEFAULT_SLAB_SIZE: SlabSize = { lengthMm: 126 * MM_PER_INCH, widthMm: 63 * MM_PER_INCH };

/** Failing the tight spots below, a whole-drawing pass tries positions this far apart —
 *  coarser than the editor's own placing, so a drawing of many pieces stays quick. */
const NEST_STEP_MM = 2 * MM_PER_INCH;
/** Turns tried for each spot: as drawn, then on its side. */
const ROTATIONS_DEG = [0, 90];

export interface NestSlab extends SlabSize {
  id: string;
}

export interface SlabEstimate {
  /** Slabs needed for everything that fits on one. */
  required: number;
  /** Items bigger than a whole slab: they cannot be cut from one, and are not counted in `required`. */
  oversize: SlabPlaceable[];
}

export interface NestResult {
  /** Each item laid on a slab, with where. */
  placements: Array<{ item: SlabPlaceable; slab: SlabPlacement }>;
  /** Items that fit on none of the slabs. */
  unplaced: SlabPlaceable[];
}

/** The size to estimate with: the biggest slab the order holds, or a jumbo slab when it holds none. */
export function standardSlab(slabs: SlabSize[]): SlabSize {
  return slabs.reduce<SlabSize>(
    (best, s) => (s.lengthMm * s.widthMm > best.lengthMm * best.widthMm ? s : best),
    slabs[0] ?? DEFAULT_SLAB_SIZE,
  );
}

/** Where `item` goes on a slab that already has `others` on it. The best spots are flush: against
 *  the slab's own edge or the edge of something already there, so those are tried first, top to
 *  bottom and left to right — pieces that exactly fill a slab are found, which a grid of fixed
 *  steps would miss by a hair. A shape that only fits by tucking into another's notch falls back
 *  to scanning the slab. */
function placeOnSlab(item: SlabPlaceable, slab: NestSlab, others: Point[][]): SlabPlacement | null {
  const edges = others.map((outline) => bounds(outline));
  const xs = [...new Set([0, ...edges.map((b) => b.maxX)])].sort((a, b) => a - b);
  const ys = [...new Set([0, ...edges.map((b) => b.maxY)])].sort((a, b) => a - b);
  for (const rotationDeg of ROTATIONS_DEG) {
    for (const y of ys) {
      for (const x of xs) {
        const placement = { slabId: slab.id, x, y, rotationDeg };
        if (slabFit(placedOutline(item, placement), slab, others) === 'fits') return placement;
      }
    }
  }
  return firstFitPlacement(item, slab.id, slab, others, NEST_STEP_MM);
}

/** Biggest footprint first: the large pieces are the hardest to place, so they get first pick
 *  of the stone and the small ones fill in around them. Ties keep their drawing order. */
function biggestFirst(items: SlabPlaceable[]): SlabPlaceable[] {
  const footprint = (item: SlabPlaceable): number => {
    const { width, height } = placedSize(item, 0);
    return width * height;
  };
  return [...items].sort((a, b) => footprint(b) - footprint(a));
}

/** How many slabs of `slab`'s size the items need if every one is cut fresh (where each sits
 *  on a slab now is ignored). */
export function estimateSlabs(items: SlabPlaceable[], slab: SlabSize): SlabEstimate {
  const taken: Point[][][] = [];
  const oversize: SlabPlaceable[] = [];
  for (const item of biggestFirst(items)) {
    let placed = false;
    for (let i = 0; i < taken.length && !placed; i += 1) {
      const spot = placeOnSlab(item, { ...slab, id: `virtual-${i}` }, taken[i]);
      if (spot) {
        taken[i].push(placedOutline(item, spot));
        placed = true;
      }
    }
    if (placed) continue;
    const fresh = placeOnSlab(item, { ...slab, id: `virtual-${taken.length}` }, []);
    if (fresh) taken.push([placedOutline(item, fresh)]);
    else oversize.push(item);
  }
  return { required: taken.length, oversize };
}

/** Lays every item not yet on a slab onto `slabs`, in the order given, leaving what is already
 *  on a slab exactly where it is and keeping clear of it. */
export function nestOnSlabs(items: SlabPlaceable[], slabs: NestSlab[]): NestResult {
  const taken = new Map<string, Point[][]>(slabs.map((s) => [s.id, []]));
  for (const item of items) {
    if (item.slab) taken.get(item.slab.slabId)?.push(placedOutline(item, item.slab));
  }

  const placements: NestResult['placements'] = [];
  const unplaced: SlabPlaceable[] = [];
  for (const item of biggestFirst(items.filter((it) => it.slab === undefined))) {
    let placed = false;
    for (const slab of slabs) {
      const others = taken.get(slab.id) ?? [];
      const spot = placeOnSlab(item, slab, others);
      if (!spot) continue;
      others.push(placedOutline(item, spot));
      placements.push({ item, slab: spot });
      placed = true;
      break;
    }
    if (!placed) unplaced.push(item);
  }
  return { placements, unplaced };
}
