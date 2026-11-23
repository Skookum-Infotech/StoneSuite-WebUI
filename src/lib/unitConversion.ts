// Pure unit conversion for document lines — a mirror of the backend's
// docextract/units.go so a line the reviewer matches by hand converts exactly
// like one the server matched. Conversion only happens inside one category
// (area, length, mass, count) and preserves the line amount.

type Category = 'area' | 'length' | 'mass' | 'count';

interface UnitDef {
  category: Category;
  /** Multiply a quantity in this unit to get the category's base unit. */
  toBase: number;
}

const UNIT_TABLE: Record<string, UnitDef> = {
  sqft: { category: 'area', toBase: 1 },
  sqm: { category: 'area', toBase: 10.7639104167 },
  in: { category: 'length', toBase: 0.0254 },
  ft: { category: 'length', toBase: 0.3048 },
  mm: { category: 'length', toBase: 0.001 },
  cm: { category: 'length', toBase: 0.01 },
  m: { category: 'length', toBase: 1 },
  lb: { category: 'mass', toBase: 0.45359237 },
  kg: { category: 'mass', toBase: 1 },
  ea: { category: 'count', toBase: 1 },
};

const ALIASES: Record<string, string> = {
  sqft: 'sqft', sf: 'sqft', ft2: 'sqft', sqfeet: 'sqft', squarefeet: 'sqft', squarefoot: 'sqft', sqfoot: 'sqft',
  sqm: 'sqm', m2: 'sqm', sqmeter: 'sqm', sqmeters: 'sqm', squaremeter: 'sqm', squaremeters: 'sqm', squaremetre: 'sqm', squaremetres: 'sqm',
  in: 'in', inch: 'in', inches: 'in',
  ft: 'ft', feet: 'ft', foot: 'ft', lf: 'ft', linft: 'ft', linearft: 'ft', linearfeet: 'ft',
  mm: 'mm', millimeter: 'mm', millimeters: 'mm',
  cm: 'cm', centimeter: 'cm', centimeters: 'cm',
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  ea: 'ea', each: 'ea', pc: 'ea', pcs: 'ea', piece: 'ea', pieces: 'ea', unit: 'ea', units: 'ea',
};

const CENTS = 100;
const QTY_DECIMALS = 1000;
/** Largest accepted change in the line amount, in cents (backend: maxConvertDriftCents). */
const MAX_DRIFT_CENTS = 1;

/** Canonical unit name for a printed spelling ("Sq. Ft", "m²"), or null when unknown. */
export function normalizeUnit(raw: string): string | null {
  const k = raw.trim().toLowerCase().replace(/²/g, '2').replace(/[.\s_-]/g, '');
  return ALIASES[k] ?? null;
}

/** True when two unit spellings name the same unit; unknown text compares as written. */
export function sameUnit(a: string, b: string): boolean {
  const na = normalizeUnit(a);
  const nb = normalizeUnit(b);
  if (na && nb) return na === nb;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface ConvertedLine {
  quantity: number;
  unitPrice: number;
}

/** Converts qty/price from one unit to another of the same category, scaling
 *  the price inversely so the amount is kept. Null for unknown units, a
 *  cross-category pair, or when rounding the price to a cent would move the
 *  amount by more than a cent (the reviewer must then decide). */
export function convertLine(quantity: number, unitPrice: number, from: string, to: string): ConvertedLine | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (!f || !t || UNIT_TABLE[f].category !== UNIT_TABLE[t].category) return null;
  if (f === t) return { quantity, unitPrice };
  const factor = UNIT_TABLE[f].toBase / UNIT_TABLE[t].toBase;
  const qty = Math.round(quantity * factor * QTY_DECIMALS) / QTY_DECIMALS;
  const price = Math.round((unitPrice / factor) * CENTS) / CENTS;
  const drift = Math.abs(Math.round(quantity * unitPrice * CENTS) - Math.round(qty * price * CENTS));
  return drift > MAX_DRIFT_CENTS ? null : { quantity: qty, unitPrice: price };
}
