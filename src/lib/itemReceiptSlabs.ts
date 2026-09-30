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
  if (!(num(slab.lengthMm) > 0 && num(slab.widthMm) > 0 && num(slab.thicknessMm) > 0)) {
    return 'length, width and thickness must all be greater than zero.';
  }
  return null;
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
