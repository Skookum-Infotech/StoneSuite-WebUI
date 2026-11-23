// Picks slabs to cover an area a job is short of.
//
// The aim is the fewest slabs, and among those the least stone wasted: one slab
// that covers the whole gap if any does (the smallest such, so a big slab is not
// used where a small one will do); otherwise take the largest slabs one at a
// time, and finish with the smallest slab that covers what is left.

/** Half a unit at the DECIMAL(14,3) scale areas are stored at. */
const AREA_EPSILON = 0.0005;

export interface SlabCandidate {
  id: string;
  area: number;
}

export interface SlabSuggestion {
  /** The slabs to allocate, in the order they were chosen. */
  ids: string[];
  /** Their combined area. */
  total: number;
  /** Whether they cover the whole gap; false when the stock is not enough. */
  covers: boolean;
}

export function suggestSlabs(candidates: SlabCandidate[], shortfall: number): SlabSuggestion {
  if (shortfall <= AREA_EPSILON) return { ids: [], total: 0, covers: true };

  const pool = candidates.filter((c) => c.area > 0).sort((a, b) => a.area - b.area);
  const ids: string[] = [];
  let total = 0;
  let remaining = shortfall;

  while (remaining > AREA_EPSILON && pool.length > 0) {
    const fit = pool.findIndex((c) => c.area + AREA_EPSILON >= remaining);
    // No single slab left is big enough: take the biggest and keep going.
    const at = fit >= 0 ? fit : pool.length - 1;
    const [chosen] = pool.splice(at, 1);
    ids.push(chosen.id);
    total += chosen.area;
    remaining -= chosen.area;
  }

  return { ids, total, covers: remaining <= AREA_EPSILON };
}
