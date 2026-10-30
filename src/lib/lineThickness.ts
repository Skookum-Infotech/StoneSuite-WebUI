// Slab thickness on a purchase order line.
//
// A PO line states the size of one slab (length x width, see lineDimensions.ts)
// and now its thickness too, so the slabs put on order when the PO is sent are
// cut to a known size. Thickness is descriptive — it never enters the line's
// quantity — and is measured in the SAME unit as length and width (the line's
// dimension unit). The server (backend `linedim.ResolveThickness`) is
// authoritative; this mirrors its limits so the form can stop a typo early.
import {
  mmToDimension, normalizeUnit, isAreaUnit, sanitizeDimensionInput, type DimensionUnit,
} from '@/lib/lineDimensions';

/** Thickest slab a line accepts (1 m), measured in centimetres so it means the
 *  same in any unit — matches the server's `linedim.MaxThicknessCM`. */
export const MAX_THICKNESS_CM = 100;

const DECIMALS = 2;
const SCALE = 10 ** DECIMALS;
const CM_PER_UNIT: Record<DimensionUnit, number> = { mm: 0.1, cm: 1, in: 2.54, ft: 30.48, m: 100 };

/** Table column for the thickness cell, appended after L / W / Slabs. */
export const THICKNESS_COL = { label: 'Thick', w: 'w-20', right: true } as const;

/** The thickest value a line accepts, in `unit`. */
export function maxThickness(unit: string | undefined): number {
  return Math.floor((MAX_THICKNESS_CM / CM_PER_UNIT[normalizeUnit(unit)]) * SCALE) / SCALE;
}

/** A thickness as the user types: digits and one decimal point with at most two
 *  places, never past the cap for the line's unit. */
export function sanitizeThickness(raw: string, unit: string | undefined): string {
  const cleaned = sanitizeDimensionInput('length', raw);
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return cleaned;
  const max = maxThickness(unit);
  return n > max ? String(max) : cleaned;
}

/** The thickness to send for a line: a positive number rounded to two decimals,
 *  only on a line measured in an area unit (the server refuses it elsewhere). */
export function thicknessPayload(raw: string | undefined, areaUnit: string | undefined): number | undefined {
  if (!isAreaUnit(areaUnit)) return undefined;
  const n = parseFloat(raw ?? '');
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const rounded = Math.round(n * SCALE) / SCALE;
  return rounded > 0 ? rounded : undefined;
}

/** A catalogue item's thickness (stored in millimetres, 0 = not stated) as the
 *  text a line starts with, in the line's unit — '' when the item states none or
 *  the line cannot carry one. */
export function thicknessFromItemMm(mm: number | null | undefined, unit: string | undefined, areaUnit: string | undefined): string {
  if (!isAreaUnit(areaUnit) || !mm || mm <= 0) return '';
  const value = mmToDimension(mm, unit);
  return value > 0 ? String(value) : '';
}

/** Header label of the thickness column in a PDF line table. */
export const PDF_THICKNESS_HEAD = 'Thick';

/** Whether any line states a thickness — a PDF only grows the column when one does. */
export function anyThickness(lines: ReadonlyArray<{ thickness?: number | null }>): boolean {
  return lines.some((l) => l.thickness !== null && l.thickness !== undefined);
}

/** One line's thickness cell in a PDF line table, with the unit it was measured in. */
export function thicknessPdfCell(line: { thickness?: number | null; dimensionUnit?: string | null }): string {
  if (line.thickness === null || line.thickness === undefined) return '—';
  return `${line.thickness} ${normalizeUnit(line.dimensionUnit)}`;
}

/** A saved line's thickness as the text the form holds. */
export function thicknessText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}
