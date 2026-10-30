// Slab-by-slab receiving — the form-side model for a purchase-order line whose
// item is tracked as individual slabs (`tracking: 'serialized'`).
//
// A receipt is the only way slabs enter inventory. For such a line the receiver
// doesn't type a quantity: they add one row per physical slab, and the line's
// received quantity is the SUM of those slabs' areas. The server recomputes
// every area and assigns every serial; what's here mirrors it so the form can
// show both before anything is saved, never to decide them.
import type { ItemReceiptLineSlab, ItemReceiptSlabInput, SlabSequence } from '@/types/itemReceipt';

const MM_PER_FOOT = 304.8;
const MM2_PER_SQM = 1_000_000;
const AREA_DECIMALS = 3;
const AREA_SCALE = 10 ** AREA_DECIMALS;
/** Serial suffix is zero-padded to at least this many digits (matches the server). */
const SERIAL_SUFFIX_DIGITS = 3;

const UNIT_SQUARE_FOOT = 'SQFT';
const UNIT_SQUARE_METRE = 'SQM';

/** One slab row on the Receive / Edit form. Dimensions stay strings while the
 *  user types; `key` is a client-only React key, never sent. */
export interface ItemReceiptDraftSlab {
  key: string;
  lengthMm: string;
  widthMm: string;
  thicknessMm: string;
  binId: string;
  blockId: string;
  lot: string;
  grade: string;
  supplierCode: string;
}

let slabKeyCounter = 0;

/** A blank slab row, optionally seeded (used to duplicate a row). The key is
 *  always freshly generated — a seed that carries its source's key (a duplicate
 *  passes the whole row) must never reuse it. */
export function newDraftSlab(seed: Partial<ItemReceiptDraftSlab> = {}): ItemReceiptDraftSlab {
  slabKeyCounter += 1;
  return {
    lengthMm: '', widthMm: '', thicknessMm: '',
    binId: '', blockId: '', lot: '', grade: '', supplierCode: '',
    ...seed,
    key: `slab-${slabKeyCounter}`,
  };
}

/** The most rows one "How many arrived?" can generate — the same ceiling as a
 *  pasted packing list, past which the count is a typo, not a delivery. */
export const MAX_GENERATED_SLABS = 500;

/** `count` identical rows, each seeded from `defaults` and given its own key.
 *  Anything that isn't a whole number from 1 to MAX_GENERATED_SLABS makes
 *  nothing — the caller says why, so a bad count never half-fills the grid. */
export function generateSlabs(count: number, defaults: Partial<ItemReceiptDraftSlab>): ItemReceiptDraftSlab[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATED_SLABS) return [];
  return Array.from({ length: count }, () => newDraftSlab(defaults));
}

/** Total slabs at or below which the receiving grid shows every slab on its own
 *  row; above it, identical slabs collapse into one group row. */
export const GROUPED_ROW_THRESHOLD = 25;

/** Slabs that share a group row: everything a receiver sets for a whole
 *  delivery. The supplier code is left out — it names one physical slab. */
export interface SlabGroup {
  key: string;
  count: number;
  /** The group's first slab, shown on its row. */
  sample: ItemReceiptDraftSlab;
  memberKeys: string[];
}

const GROUP_KEY_FIELDS = ['lengthMm', 'widthMm', 'thicknessMm', 'binId', 'lot', 'grade', 'blockId'] as const;

export function slabGroupKey(slab: ItemReceiptDraftSlab): string {
  return JSON.stringify(GROUP_KEY_FIELDS.map((f) => slab[f]));
}

/** Groups in order of first appearance, in one pass. */
export function groupSlabs(slabs: ItemReceiptDraftSlab[]): SlabGroup[] {
  const groups = new Map<string, SlabGroup>();
  for (const slab of slabs) {
    const key = slabGroupKey(slab);
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      group.memberKeys.push(slab.key);
    } else {
      groups.set(key, { key, count: 1, sample: slab, memberKeys: [slab.key] });
    }
  }
  return [...groups.values()];
}

/** Applies `fields` to the slabs named by `memberKeys`, touching nothing else. */
export function patchGroupMembers(
  slabs: ItemReceiptDraftSlab[],
  memberKeys: string[],
  fields: Partial<ItemReceiptDraftSlab>,
): ItemReceiptDraftSlab[] {
  const members = new Set(memberKeys);
  return slabs.map((s) => (members.has(s.key) ? { ...s, ...fields, key: s.key } : s));
}

/** The units a slab table speaks in: the area unit of the line (SQFT, SQM) and the
 *  length unit the item is measured in, which sizes are shown and typed in. */
export interface SlabUnits {
  area: string;
  length: string;
}

/** Which slabs a bulk bin assignment reaches: positions down the line, counted
 *  from 1 and inclusive (the same numbers the rows are labelled with). */
export interface BinAssignScope {
  from?: number;
  to?: number;
  /** Skip slabs that already have a bin. */
  onlyUnassigned?: boolean;
}

function reaches(slab: ItemReceiptDraftSlab, index: number, total: number, scope: BinAssignScope): boolean {
  const position = index + 1;
  if (position < (scope.from ?? 1) || position > (scope.to ?? total)) return false;
  return !(scope.onlyUnassigned && slab.binId);
}

/** How many slabs `assignBin` would set for this scope. */
export function countReached(slabs: ItemReceiptDraftSlab[], scope: BinAssignScope): number {
  return slabs.filter((s, i) => reaches(s, i, slabs.length, scope)).length;
}

/** Puts the slabs in `scope` into `binId` (blank clears it), touching nothing
 *  else — a 100-slab delivery goes into a bin in one step, not one by one. */
export function assignBin(slabs: ItemReceiptDraftSlab[], binId: string, scope: BinAssignScope): ItemReceiptDraftSlab[] {
  return slabs.map((s, i) => (reaches(s, i, slabs.length, scope) ? { ...s, binId } : s));
}

/** Rows shown at once in a slab table; a longer delivery is paged. */
export const SLAB_PAGE_SIZE = 25;

export interface SlabPage<T> {
  items: T[];
  /** Index of the page's first item in the whole list, so row labels stay absolute. */
  offset: number;
  page: number;
  pageCount: number;
  total: number;
}

/** One page of a list, 1-based. A page past the end (rows were removed) reads as
 *  the last page, and an empty list is one empty page. */
export function pageOf<T>(all: T[], requested: number, size: number = SLAB_PAGE_SIZE): SlabPage<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pageCount);
  const offset = (page - 1) * size;
  return { items: all.slice(offset, offset + size), offset, page, pageCount, total: all.length };
}

/** Rebuilds an editable row from a slab already saved on a receipt line. */
export function draftSlabFromLine(s: ItemReceiptLineSlab): ItemReceiptDraftSlab {
  return newDraftSlab({
    lengthMm: String(s.lengthMm),
    widthMm: String(s.widthMm),
    thicknessMm: String(s.thicknessMm),
    binId: s.binId ?? '',
    blockId: s.blockId ?? '',
    lot: s.lot ?? '',
    grade: s.grade ?? '',
    supplierCode: s.supplierCode ?? '',
  });
}

function num(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Area of one slab in the item's own unit — 0 when a dimension is missing or
 *  the unit isn't a measurable area unit. Mirrors inventory.AreaFor. */
export function slabArea(lengthMm: string, widthMm: string, unitCode: string): number {
  const mm2 = num(lengthMm) * num(widthMm);
  if (!(mm2 > 0)) return 0;
  if (unitCode === UNIT_SQUARE_FOOT) return Math.round((mm2 / (MM_PER_FOOT * MM_PER_FOOT)) * AREA_SCALE) / AREA_SCALE;
  if (unitCode === UNIT_SQUARE_METRE) return Math.round((mm2 / MM2_PER_SQM) * AREA_SCALE) / AREA_SCALE;
  return 0;
}

/** A line's received quantity: the sum of its slabs' areas. */
export function slabsTotalArea(slabs: ItemReceiptDraftSlab[], unitCode: string): number {
  const total = slabs.reduce((sum, s) => sum + slabArea(s.lengthMm, s.widthMm, unitCode), 0);
  return Math.round(total * AREA_SCALE) / AREA_SCALE;
}

/** Why a slab row can't be saved, or null when it can. */
export function slabProblem(slab: ItemReceiptDraftSlab): string | null {
  const missing = [
    num(slab.lengthMm) > 0 ? null : 'length',
    num(slab.widthMm) > 0 ? null : 'width',
    num(slab.thicknessMm) > 0 ? null : 'thickness',
  ].filter((name): name is string => name !== null);
  if (missing.length === 0) return null;
  // Name only what is missing — a slab short of its thickness alone is told so,
  // rather than being sent hunting through three fields.
  if (missing.length === 3) return 'length, width and thickness must all be greater than zero.';
  return `${missing.join(' and ')} must be greater than zero.`;
}

function trimmedOrUndefined(v: string): string | undefined {
  return v.trim() || undefined;
}

/** Maps a slab row to the create/update payload. */
export function toSlabInput(s: ItemReceiptDraftSlab): ItemReceiptSlabInput {
  return {
    lengthMm: num(s.lengthMm),
    widthMm: num(s.widthMm),
    thicknessMm: num(s.thicknessMm),
    binId: trimmedOrUndefined(s.binId),
    blockId: trimmedOrUndefined(s.blockId),
    lot: trimmedOrUndefined(s.lot),
    grade: trimmedOrUndefined(s.grade),
    supplierCode: trimmedOrUndefined(s.supplierCode),
  };
}

export function formatSlabSerial(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(SERIAL_SUFFIX_DIGITS, '0')}`;
}

/** How many slabs have arrived against an order line, next to how many the
 *  buyer expected: "11 of about 12 slabs". Without an expectation it just
 *  counts what has arrived. Informational only — the line's area quantity is
 *  what drives receiving and billing. */
export function slabProgressText(received: number, expected: number | null | undefined): string {
  if (expected && expected > 0) return `${received} of about ${expected} slab${expected === 1 ? '' : 's'}`;
  return `${received} slab${received === 1 ? '' : 's'}`;
}

/** The serials the form previews, per purchase-order line, in the order the
 *  server will assign them: slabs are numbered continuously down the receipt,
 *  line by line. Empty strings while the sequence is still loading. */
export function previewSerials(
  lines: Array<{ purchaseOrderItemId: string; slabs: ItemReceiptDraftSlab[] }>,
  sequence: SlabSequence | undefined,
): Record<string, string[]> {
  let next = sequence?.next ?? 0;
  const out: Record<string, string[]> = {};
  for (const line of lines) {
    if (line.slabs.length === 0) continue;
    out[line.purchaseOrderItemId] = line.slabs.map(() => {
      if (!sequence) return '';
      const serial = formatSlabSerial(sequence.prefix, next);
      next += 1;
      return serial;
    });
  }
  return out;
}
