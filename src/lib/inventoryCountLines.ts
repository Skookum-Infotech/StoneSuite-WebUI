// Pure decision helpers for the cycle-count review grid (spec §9) — kept
// separate from CountLinesGrid.tsx so the null-vs-zero and reason-required
// rules are table-testable without mounting a component.
import type { CountLine } from '@/types/inventory';

/** `countedQty: null` means "not counted yet" — deliberately distinct from a
 *  counted zero. Collapsing the two would write off every shelf the crew
 *  simply had not reached yet. */
export function countedQtyDisplay(countedQty: number | null | undefined): string {
  if (countedQty === null || countedQty === undefined) return 'not counted';
  return String(countedQty);
}

/** A serialized line's "counted" state is binary — found or missing — never
 *  a quantity. */
export function foundDisplay(countedQty: number | null | undefined): string {
  if (countedQty === null || countedQty === undefined) return 'not counted';
  return countedQty > 0 ? 'Found' : 'Missing';
}

/** A line needs a reason wherever it has a variance or was unexpected — the
 *  server blocks posting on exactly this condition, naming the line; this
 *  mirrors that so the review grid can flag it before the round trip. */
export function lineNeedsReason(line: Pick<CountLine, 'variance' | 'isUnexpected'>): boolean {
  return (line.variance ?? 0) !== 0 || line.isUnexpected;
}

/** Reasons can only be recorded while counting (inventorycount.AcceptsCounts
 *  only accepts CNTG) — a line that reaches review with a variance and no
 *  reason cannot be fixed in place; it has to go back via Recount. */
export function lineBlocksPost(line: Pick<CountLine, 'variance' | 'isUnexpected' | 'reasonId'>): boolean {
  return lineNeedsReason(line) && !line.reasonId;
}
