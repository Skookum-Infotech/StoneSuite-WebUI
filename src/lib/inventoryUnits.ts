// Pure helpers driven by lkp_unit.extra.category — the discriminator that
// decides whether an item/unit form prompts for dimensions, and which units
// are legal for a serialized (slab) item. Kept out of component files per
// the eslint-plugin-react-refresh `vite` preset (non-component exports break
// Fast Refresh for a component file).
import type { LookupItem, UnitCategory } from '@/types/inventory';

/** Reads a unit lookup row's `extra.category`, defaulting to 'count' (the
 *  safest default — a mis-typed/missing category should never silently
 *  demand dimensions the tenant never intended). */
export function unitCategory(unit: Pick<LookupItem, 'extra'> | undefined | null): UnitCategory {
  const cat = unit?.extra?.category;
  return cat === 'length' || cat === 'area' || cat === 'volume' || cat === 'weight' ? cat : 'count';
}

/** A count item must not prompt for dimensions (spec §1) — every other
 *  category may carry a physical measurement. */
export function requiresDimensions(unit: Pick<LookupItem, 'extra'> | undefined | null): boolean {
  return unitCategory(unit) !== 'count';
}

/** Only an area unit (SQFT/SQM) may back a serialized item — a Unit (slab)
 *  is measured in mm and its area is computed into the item's own unit; a
 *  non-area unit here would silently misinterpret that area (spec §3). */
export function isAreaUnit(unit: Pick<LookupItem, 'extra'> | undefined | null): boolean {
  return unitCategory(unit) === 'area';
}

/** Finds a unit lookup row by id — the common lookup pattern used by every
 *  category/dimension check above. */
export function findUnit(units: LookupItem[], unitId: number | null | undefined): LookupItem | undefined {
  if (unitId === null || unitId === undefined) return undefined;
  return units.find((u) => u.id === unitId);
}
