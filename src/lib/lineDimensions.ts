// Length / width / slabs on document lines.
//
// Stone is priced by area but sold and ordered by the slab. A line may state the
// size of one slab (length x width) and how many slabs it covers; when it does,
// the line's quantity is NOT typed — it is the area, length x width x slabs, in
// the item's own area unit. Everything else on the line (amount, tax, total) keeps
// running off that quantity, so a sized line is priced exactly like any other.
//
// Length and width are measured in ONE unit — the line's dimension unit, copied
// from its inventory item when the line is added and kept on the line — so a slab
// can never be "120 in x 300 cm", and a saved document never changes when its
// item is later switched to another unit.
//
// The server derives the same quantity from the same numbers and is
// authoritative; this mirrors it (backend `linedim`) so the form can show the
// figure live, never to decide it. Both round the same way — dimensions to two
// decimals, the area to three — and use the same constants, so what is shown is
// what is saved.

/** Units a slab's length and width can be measured in. */
export const DIMENSION_UNITS = ['mm', 'cm', 'in', 'ft', 'm'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

/** What an item or line without a stated unit is measured in. */
export const DEFAULT_DIMENSION_UNIT: DimensionUnit = 'in';

/** Option labels for the item form's unit select. */
export const DIMENSION_UNIT_LABELS: Record<DimensionUnit, string> = {
  mm: 'Millimetres (mm)',
  cm: 'Centimetres (cm)',
  in: 'Inches (in)',
  ft: 'Feet (ft)',
  m: 'Metres (m)',
};

/** Exact by definition: an inch is 2.54 cm and a foot 30.48 cm. */
const CM_PER_UNIT: Record<DimensionUnit, number> = { mm: 0.1, cm: 1, in: 2.54, ft: 30.48, m: 100 };
/** cm^2 in one square unit — written out so server and client share the figures. */
const CM2_PER_SQUARE_UNIT: Record<DimensionUnit, number> = { mm: 0.01, cm: 1, in: 6.4516, ft: 929.0304, m: 10_000 };

const CM2_PER_SQUARE_FOOT = 929.0304;
const CM2_PER_SQUARE_METER = 10_000;

const UNIT_SQUARE_FOOT = 'SQFT';
const UNIT_SQUARE_METER = 'SQM';

const DIMENSION_DECIMALS = 2;
const QUANTITY_DECIMALS = 3;
const DIMENSION_SCALE = 10 ** DIMENSION_DECIMALS;
const QUANTITY_SCALE = 10 ** QUANTITY_DECIMALS;

/** Longest length or width a line accepts (100 m), measured in centimetres so it
 *  means the same in any unit — matches the server. */
export const MAX_DIMENSION_CM = 10_000;
/** Largest slab count a line accepts — matches the server. */
export const MAX_SLABS = 10_000;

/** The strings a line holds while the user types. Blank means "not stated". */
export interface LineDimensions {
  length?: string;
  width?: string;
  slabs?: string;
  /** The one unit length and width are measured in; blank reads as inches. */
  dimensionUnit?: string;
}

/** What the server returns for a saved line. */
export interface LineDimensionsResponse {
  length?: number | null;
  width?: number | null;
  slabs?: number | null;
  dimensionUnit?: string | null;
}

/** The same, in the shape a create/update payload takes. */
export interface LineDimensionsPayload {
  length?: number;
  width?: number;
  slabs?: number;
  dimensionUnit?: string;
}

/** Table columns for the three fields, spliced between SKU and Units. The unit
 *  differs per item, so it shows inside each cell rather than in the header. */
export const LINE_DIMENSION_COLS = [
  { label: 'L', w: 'w-20', right: true },
  { label: 'W', w: 'w-20', right: true },
  { label: 'Slabs', w: 'w-16', right: true },
] as const;

/** Shown when the three inputs are disabled for the line's unit. */
export const DIMENSIONS_UNIT_HINT = 'Length, width and slabs apply to lines measured in sq ft or sq m.';

/** A dimension unit from whatever was stored or sent: anything unknown or blank
 *  is inches, the default unit (matches the server). */
export function normalizeUnit(raw: string | null | undefined): DimensionUnit {
  const u = (raw ?? '').trim().toLowerCase();
  return (DIMENSION_UNITS as readonly string[]).includes(u) ? (u as DimensionUnit) : DEFAULT_DIMENSION_UNIT;
}

/** The unit a line takes from the catalog item it was picked from. */
export function itemDimensionUnit(item: { dimensionUnit?: string | null }): DimensionUnit {
  return normalizeUnit(item.dimensionUnit);
}

function divisorFor(areaUnit: string | undefined): number | null {
  const code = (areaUnit ?? '').trim().toUpperCase();
  if (code === UNIT_SQUARE_FOOT) return CM2_PER_SQUARE_FOOT;
  if (code === UNIT_SQUARE_METER) return CM2_PER_SQUARE_METER;
  return null;
}

/** Whether length / width / slabs mean anything on a line in this unit. */
export function isAreaUnit(areaUnit: string | undefined): boolean {
  return divisorFor(areaUnit) !== null;
}

/** A typed dimension as a number rounded to two decimals — 0 when blank, not a
 *  number or not positive, so a half-typed field never produces an area. */
function positive(raw: string | undefined, scale: number): number {
  const n = parseFloat(raw ?? '');
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * scale) / scale;
}

function slabCount(raw: string | undefined): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Length and width are both stated — the condition under which the quantity is
 *  derived. A slab count alone only describes the line. */
export function hasSize(d: LineDimensions): boolean {
  return positive(d.length, DIMENSION_SCALE) > 0 && positive(d.width, DIMENSION_SCALE) > 0;
}

/** The line is priced from its dimensions: sized, and in an area unit. */
export function isSized(d: LineDimensions, areaUnit: string | undefined): boolean {
  return hasSize(d) && isAreaUnit(areaUnit);
}

/** The quantity a sized line works out to — '' when it is not sized, or the
 *  area is too small to price. Slabs left blank count as one. The expression
 *  order matches the server's so both round the same way. */
export function sizedQuantity(d: LineDimensions, areaUnit: string | undefined): string {
  const divisor = divisorFor(areaUnit);
  if (divisor === null || !hasSize(d)) return '';
  const unit = normalizeUnit(d.dimensionUnit);
  const length = positive(d.length, DIMENSION_SCALE);
  const width = positive(d.width, DIMENSION_SCALE);
  const slabs = slabCount(d.slabs) || 1;
  const area = Math.round(((length * width * slabs * CM2_PER_SQUARE_UNIT[unit]) / divisor) * QUANTITY_SCALE) / QUANTITY_SCALE;
  return area > 0 ? String(area) : '';
}

function anyStated(d: LineDimensions): boolean {
  return Boolean(d.length || d.width || d.slabs);
}

/** Brings a line's quantity in step with its dimensions as the user edits: in an
 *  area unit with a length and width, quantity becomes the area. Otherwise the
 *  line is returned untouched — its quantity is typed. Never drops anything, so
 *  retyping a free-text unit ("S" → "SQ" → "SQM") can't wipe a size on the way.
 *
 *  `slabs` defaults to the line's own; a purchase order line keeps its slab count
 *  in expectedSlabs and passes that instead. */
export function withSizedQuantity<T extends LineDimensions & { quantity: string; units?: string }>(
  line: T,
  slabs: string | undefined = line.slabs,
): T {
  const quantity = sizedQuantity({ length: line.length, width: line.width, slabs, dimensionUnit: line.dimensionUnit }, line.units);
  return quantity === '' ? line : { ...line, quantity };
}

/** Drops the dimensions from a line whose item can't be sized (Each, a service,
 *  no item yet), so a stale 300 × 150 never rides along when the line is switched
 *  to a per-piece item. Call it when the line's ITEM changes, not on every edit. */
export function withoutUnsupportedSize<T extends LineDimensions & { units?: string }>(line: T): T {
  if (isAreaUnit(line.units) || !anyStated(line)) return line;
  return { ...line, length: '', width: '', slabs: '' };
}

/** The longest length or width the server accepts, in `unit`: 100 m is 10 000 cm,
 *  100 000 mm, about 3937 in, 328.08 ft or 100 m. */
export function maxDimension(unit: string | undefined): number {
  return Math.floor((MAX_DIMENSION_CM / CM_PER_UNIT[normalizeUnit(unit)]) * DIMENSION_SCALE) / DIMENSION_SCALE;
}

/** A length or width as the user types: kept as typed, but never negative and
 *  never past the server's cap for the line's unit. */
export function clampDimension(raw: string, unit?: string): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (n < 0) return '0';
  const max = maxDimension(unit);
  return n > max ? String(max) : raw;
}

/** A slab count as the user types: whole, never negative, never past the cap. */
export function clampSlabs(raw: string): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  if (n < 0) return '0';
  return n > MAX_SLABS ? String(MAX_SLABS) : String(Math.trunc(n));
}

/** The three boxes a line states its slab size in. */
export type DimensionField = 'length' | 'width' | 'slabs';

/** How far an arrow key moves a box, and how far with Shift held. */
export const DIMENSION_STEP = 1;
export const DIMENSION_STEP_COARSE = 10;

const LEADING_ZEROS = /^0+(?=\d)/;

/** What a length / width / slabs box keeps of whatever was typed or pasted: only
 *  digits and, for a size, one decimal point with at most two places. So "1,200",
 *  "12 in" or "7..5" land as the number meant, and a stray letter or minus sign
 *  simply doesn't appear — nothing is left for the user to hunt down and delete.
 *  Never blanks a half-typed "12." or "0.", so typing a decimal isn't interrupted. */
export function sanitizeDimensionInput(field: DimensionField, raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (field === 'slabs') return (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(LEADING_ZEROS, '');
  if (dot === -1) return cleaned.replace(LEADING_ZEROS, '');
  const whole = cleaned.slice(0, dot).replace(LEADING_ZEROS, '') || '0';
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, DIMENSION_DECIMALS);
  return `${whole}.${fraction}`;
}

/** The value an arrow key gives a box: `amount` up or down from what is there,
 *  never below zero for a size or below one for a slab count. A blank box steps
 *  from its floor — a blank slab count already means one. */
export function stepDimension(field: DimensionField, raw: string, direction: 1 | -1, amount: number = DIMENSION_STEP): string {
  const floor = field === 'slabs' ? 1 : 0;
  const typed = parseFloat(raw);
  const from = Number.isFinite(typed) ? typed : floor;
  const moved = field === 'slabs' ? Math.trunc(from) + direction * amount : from + direction * amount;
  return String(Math.max(floor, Math.round(moved * DIMENSION_SCALE) / DIMENSION_SCALE));
}

/** Clamps whichever of the three fields an inline editor just changed; any
 *  other key is returned as typed, so one `onChange` can route every field. */
export function clampDimensionField(key: string, raw: string, unit?: string): string {
  if (key === 'length' || key === 'width') return clampDimension(raw, unit);
  if (key === 'slabs') return clampSlabs(raw);
  return raw;
}

/** The dimensions to send for a line. A line that can't be sized sends none, and
 *  length / width go together — with the unit they were measured in — or not at
 *  all, matching what the server accepts. */
export function dimensionsPayload(d: LineDimensions, areaUnit: string | undefined): LineDimensionsPayload {
  if (!isAreaUnit(areaUnit)) return {};
  const slabs = slabCount(d.slabs);
  if (!hasSize(d)) return slabs > 0 ? { slabs } : {};
  return {
    length: positive(d.length, DIMENSION_SCALE),
    width: positive(d.width, DIMENSION_SCALE),
    ...(slabs > 0 ? { slabs } : {}),
    dimensionUnit: normalizeUnit(d.dimensionUnit),
  };
}

/** Rebuilds a form line's dimensions from a saved line. */
export function dimensionsFromLine(line: LineDimensionsResponse): Required<LineDimensions> {
  const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
  return {
    length: text(line.length),
    width: text(line.width),
    slabs: text(line.slabs),
    dimensionUnit: normalizeUnit(line.dimensionUnit),
  };
}

/** "120 × 60 in · 2 slabs" — '' when the line states none of it. */
export function sizeSummary(d: LineDimensions): string {
  const parts: string[] = [];
  if (hasSize(d)) parts.push(`${d.length} × ${d.width} ${normalizeUnit(d.dimensionUnit)}`);
  const slabs = slabCount(d.slabs);
  if (slabs > 0) parts.push(`${slabs} ${slabs === 1 ? 'slab' : 'slabs'}`);
  return parts.join(' · ');
}

/** Header labels for the three columns of a PDF line table. */
export const PDF_DIMENSION_HEAD: string[] = ['L', 'W', 'Slabs'];

/** Whether any line states a slab size or count. A PDF only grows the three
 *  columns when one does, so a document without any prints exactly as before. */
export function anyDimensions(lines: readonly LineDimensionsResponse[]): boolean {
  const stated = (n: number | null | undefined) => n !== null && n !== undefined;
  return lines.some((l) => stated(l.length) || stated(l.width) || stated(l.slabs));
}

/** The three cells of one line in a PDF line table, each size carrying its unit
 *  ("120 in"). `slabs` overrides the line's own count (a purchase order line
 *  keeps it in expectedSlabs). */
export function dimensionCells(line: LineDimensionsResponse, slabs: number | null | undefined = line.slabs): string[] {
  const unit = normalizeUnit(line.dimensionUnit);
  const size = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n} ${unit}`);
  return [size(line.length), size(line.width), slabs === null || slabs === undefined ? '—' : String(slabs)];
}
