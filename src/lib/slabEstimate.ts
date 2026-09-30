// Estimating a slab line's quantity. Stone is priced by area (per sq ft or per
// sq m) but ordered by bundle or lot, so a buyer knows a slab COUNT and an
// approximate size while the exact area is only known once the slabs are
// measured at receiving. These turn "12 slabs of about 50 sq ft" into the
// area quantity the order line needs, and back again when editing a saved line.
const ESTIMATE_DECIMALS = 3;
const SCALE = 10 ** ESTIMATE_DECIMALS;

function positive(raw: string | undefined | null): number {
  const n = parseFloat(raw ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Trims a number to the estimate's precision without trailing zeros: 600, 583.4. */
function tidy(n: number): string {
  return String(Math.round(n * SCALE) / SCALE);
}

/** slabs × average area per slab, as the quantity string for the order line —
 *  or '' when either isn't a positive number (so a half-typed helper never
 *  overwrites the quantity with nonsense). */
export function estimateQuantity(slabs: string, avgAreaPerSlab: string): string {
  const count = positive(slabs);
  const avg = positive(avgAreaPerSlab);
  if (count === 0 || avg === 0) return '';
  return tidy(count * avg);
}

/** The average area per slab a saved line implies (quantity ÷ slabs), used to
 *  pre-fill the helper when a line is edited. '' when it can't be worked out. */
export function impliedAverage(quantity: string, slabs: string): string {
  const q = positive(quantity);
  const count = positive(slabs);
  if (q === 0 || count === 0) return '';
  return tidy(q / count);
}

/** A whole, positive slab count for the payload, or undefined when the field is
 *  blank or not a valid count. */
export function toExpectedSlabs(raw: string | undefined | null): number | undefined {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
