import type { MaterialConsumptionRow } from '@/types/dashboardData';

// Curated stone-like gradients, used when an item has no color assigned (or
// its color has no hex swatch set yet -- see LookupVocabularyTable.tsx,
// which is what actually lets a tenant set one). Keeps every row looking
// like a real stone sample instead of a flat grey placeholder box -- same
// spirit as the widget's original mock data.
const FALLBACK_SWATCHES = [
  'linear-gradient(125deg,#e9e9e7,#d3d3cf 55%,#e9e9e7)',
  'linear-gradient(120deg,#efeae1,#e0d8ca 60%,#efeae1)',
  'radial-gradient(circle at 30% 30%,#423f3a,#17140f 70%)',
  'linear-gradient(130deg,#d9cfc0,#bda98d 60%,#d9cfc0)',
  'linear-gradient(115deg,#4a5b52,#26332c 60%,#3d4c44)',
  'linear-gradient(128deg,#cfd6d9,#9fb0b6 55%,#cfd6d9)',
];

/**
 * Stable, deterministic index into a fixed-length list from a string id --
 * the same item always lands on the same fallback swatch across renders and
 * reloads, so a material's card doesn't visually "shuffle" on refresh.
 */
function hashIndex(id: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/**
 * CSS background for a material's swatch. A real color_hex (set via Config →
 * Inventory Setup → Colors) renders as a soft gradient tinted from that
 * color; an item with no swatch set falls back to a deterministic stone-like
 * gradient keyed on its id, so it never renders as an empty/grey box.
 */
export function materialSwatchStyle(colorHex: string, id: string): { backgroundImage: string } {
  if (colorHex) {
    return { backgroundImage: `linear-gradient(135deg, ${colorHex}, ${colorHex}cc 55%, ${colorHex}ee)` };
  }
  return { backgroundImage: FALLBACK_SWATCHES[hashIndex(id, FALLBACK_SWATCHES.length)] };
}

/**
 * Formats an area figure for display: a whole number when it is one, or
 * trimmed to a single decimal place otherwise (same convention as
 * lib/inventoryAlert.ts's formatStockQty), with the item's own unit code
 * appended lowercase -- e.g. "412 sqft". Units are never summed across rows
 * in this widget since items can carry different ones.
 */
export function formatMaterialArea(value: number, unitCode: string): string {
  const n = value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return unitCode ? `${n} ${unitCode.toLowerCase()}` : n;
}

/**
 * Builds the widget row's secondary detail line -- slab count, plus how much
 * came back as recovered remnants when any did. Scrapped area is
 * deliberately NOT folded in here: it renders as its own amber chip (see
 * MaterialConsumption.tsx) so a real loss stands out rather than blending
 * into a comma-separated list of numbers.
 */
export function materialDetailLine(row: MaterialConsumptionRow): string {
  const slabPart = `${row.slabCount} ${row.slabCount === 1 ? 'slab' : 'slabs'}`;
  if (row.recoveredArea > 0) {
    return `${slabPart} · ${formatMaterialArea(row.recoveredArea, row.unitCode)} recovered`;
  }
  return slabPart;
}
