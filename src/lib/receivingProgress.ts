import type { PurchaseOrderLine } from '@/types/purchaseOrder';

// Pure maths behind the purchase order "Received" progress bar and its card.
// receivedPercent() mirrors StoneSuite-Backend purchaseorder/receipt_progress.go
// (which fills `receivedPercent` on list rows): per-line fraction, averaged,
// rounded. Keep the two in step or a list bar and its own card will disagree.

export const PROGRESS_SEGMENTS = 10;

const PERCENT_SCALE = 100;
const PERCENT_COMPLETE = 100;
const PERCENT_ALMOST = PERCENT_COMPLETE - 1;
const QUANTITY_DECIMALS = 2;

/** Statuses a purchase order can be receiving goods in — before SENT nothing
 *  can arrive, and a cancelled order never will. */
const RECEIVING_STATUS_CODES: ReadonlySet<string> = new Set(['SENT', 'PART', 'RCVD', 'CLSD']);

/** Statuses where a past-due expected date means goods are late. A received or
 *  closed order is not late, even if it closed short. */
const AWAITING_STATUS_CODES: ReadonlySet<string> = new Set(['SENT', 'PART']);

export type LineQuantities = Pick<PurchaseOrderLine, 'quantity' | 'qtyReceived' | 'qtyBilled'>;

export type ProgressTone = 'empty' | 'partial' | 'complete';

export function showsReceivingProgress(statusCode: string): boolean {
  return RECEIVING_STATUS_CODES.has(statusCode);
}

/** `done` as a share of `ordered`, clamped to 0..1 so an over-delivery on one
 *  line cannot hide a short one. */
export function lineFraction(done: number, ordered: number): number {
  if (!(ordered > 0)) return 0;
  return Math.min(Math.max(done, 0) / ordered, 1);
}

/** A whole percent that never overstates: short of complete reads at most 99,
 *  and anything at all reads at least 1. */
export function toWholePercent(fraction: number): number {
  const pct = Math.round(fraction * PERCENT_SCALE);
  if (fraction < 1 && pct >= PERCENT_COMPLETE) return PERCENT_ALMOST;
  if (fraction > 0 && pct === 0) return 1;
  return pct;
}

export function linePercent(done: number, ordered: number): number {
  return toWholePercent(lineFraction(done, ordered));
}

/** Lines that carry an ordered quantity; the rest take no part in progress. */
function orderedLines(lines: readonly LineQuantities[]): LineQuantities[] {
  return lines.filter((l) => l.quantity > 0);
}

function averageFraction(lines: readonly LineQuantities[], done: (l: LineQuantities) => number): number {
  const counted = orderedLines(lines);
  if (counted.length === 0) return 0;
  const sum = counted.reduce((acc, l) => acc + lineFraction(done(l), l.quantity), 0);
  return sum / counted.length;
}

/** How far through receiving an order is: the average of each line's own
 *  percent. Lines can differ in unit (sq ft, each), so quantities are never
 *  added together. */
export function receivedPercent(lines: readonly LineQuantities[]): number {
  return toWholePercent(averageFraction(lines, (l) => l.qtyReceived));
}

/** Same measure for billing: each line's billed ÷ ordered, averaged. */
export function billedPercent(lines: readonly LineQuantities[]): number {
  return toWholePercent(averageFraction(lines, (l) => l.qtyBilled));
}

export interface LineCounts {
  received: number;
  total: number;
}

/** How many lines are fully received, out of those that carry a quantity. */
export function lineCounts(lines: readonly LineQuantities[]): LineCounts {
  const counted = orderedLines(lines);
  return { received: counted.filter((l) => l.qtyReceived >= l.quantity).length, total: counted.length };
}

export function progressTone(percent: number): ProgressTone {
  if (percent >= PERCENT_COMPLETE) return 'complete';
  return percent > 0 ? 'partial' : 'empty';
}

/** How many of the bar's segments are lit. Same never-overstate rule as the
 *  percent: all lit only when complete, at least one lit once anything arrived. */
export function filledSegments(percent: number, segments: number = PROGRESS_SEGMENTS): number {
  if (percent <= 0) return 0;
  if (percent >= PERCENT_COMPLETE) return segments;
  return Math.min(segments - 1, Math.max(1, Math.round((percent / PERCENT_COMPLETE) * segments)));
}

/** A quantity without float noise (0.1 + 0.2 reads 0.3, not 0.30000000000000004). */
export function formatQuantity(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: QUANTITY_DECIMALS });
}

/** True when goods are still owed past the expected date. `expectedDate` and
 *  `today` are yyyy-mm-dd, which order correctly as plain strings. */
export function isOverdue(
  order: { statusCode: string; expectedDate?: string },
  percent: number,
  today: string,
): boolean {
  if (!order.expectedDate || !AWAITING_STATUS_CODES.has(order.statusCode)) return false;
  return percent < PERCENT_COMPLETE && order.expectedDate.slice(0, today.length) < today;
}
