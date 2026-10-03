import { lineReviewKey, type HandoffLine, type LinePill, type ProvenanceInfo, type ReviewItem } from '@/lib/salesOrderDocumentHandoff';
import type { SOLineItem } from '@/lib/salesOrderForm';
import { sameUnit } from '@/lib/unitConversion';

// Pure review-progress helpers shared by the review header, navigator,
// checklist and the Save gate.

const CENTS = 100;
const EPSILON = 0.005;

/** What is resolved right now, taken from the live form. */
export interface ReviewContext {
  hasCustomer: boolean;
  /** True when the form line with this review key has a catalog item picked. */
  lineHasItem: (key: string) => boolean;
  reviewed: ReadonlySet<string>;
}

function isResolved(item: ReviewItem, ctx: ReviewContext): boolean {
  if (item.resolvedByReview) return ctx.reviewed.has(item.key);
  if (item.key === 'customer' && item.required) return ctx.hasCustomer;
  if (item.key.startsWith('line:') && item.required) return ctx.lineHasItem(item.key);
  return ctx.reviewed.has(item.key);
}

/** Required checks for lines whose picked item is sold in a different unit than
 *  the document states while the quantity is still the document's — i.e. it was
 *  never converted ("4 EA" saved as "4 SQFT"). Derived from the live form, so
 *  it covers an item picked in the review panel or in the items table and
 *  survives a reload. Cleared only by "Mark reviewed". */
export function unitCheckItems(lines: HandoffLine[], formLines: SOLineItem[]): ReviewItem[] {
  return lines.flatMap((meta) => {
    const line = formLines.find((l) => l.id === meta.id);
    if (!line?.inventoryItemUuid || !meta.docUom || !line.units || sameUnit(meta.docUom, line.units)) return [];
    if (meta.docQty === null || (parseFloat(line.quantity) || 0) !== meta.docQty) return [];
    return [{
      key: lineReviewKey(meta.lineNo), label: `Line ${meta.lineNo}`, required: true, resolvedByReview: true,
      reason: `The document says ${meta.docQty} ${meta.docUom}, but ${line.itemName} is sold in ${line.units} - check the quantity, then mark it reviewed.`,
    }];
  });
}

/** Unresolved items, one per field key (reasons joined), in checklist order. */
export function pendingReviewItems(items: ReviewItem[], ctx: ReviewContext): ReviewItem[] {
  const byKey = new Map<string, ReviewItem>();
  items.forEach((item) => {
    if (isResolved(item, ctx)) return;
    const prev = byKey.get(item.key);
    byKey.set(item.key, prev
      ? { ...prev, reason: `${prev.reason} ${item.reason}`, required: prev.required || item.required }
      : item);
  });
  return Array.from(byKey.values());
}

/** The unresolved items that block Save. */
export function blockingItems(pending: ReviewItem[]): ReviewItem[] {
  return pending.filter((i) => i.required);
}

/** Inline reason shown beside a disabled Save, or '' when nothing blocks it. */
export function saveBlockedReason(pending: ReviewItem[]): string {
  const n = blockingItems(pending).length;
  if (n === 0) return '';
  return `${n} required ${n === 1 ? 'item' : 'items'} to review`;
}

/** Provenance keys that "Confirm all high-confidence" may mark reviewed:
 *  high confidence and nothing flagged on them. */
export function confirmableKeys(provenance: Record<string, ProvenanceInfo>, items: ReviewItem[]): string[] {
  const flagged = new Set(items.map((i) => i.key));
  return Object.keys(provenance).filter((k) => provenance[k].confidence === 'high' && !flagged.has(k));
}

/** "X of Y reviewed" over every field that carries provenance. */
export function reviewProgress(
  provenance: Record<string, ProvenanceInfo>, items: ReviewItem[], ctx: ReviewContext,
): { done: number; total: number } {
  const keys = Object.keys(provenance);
  const requiredKeys = new Set(items.filter((i) => i.required).map((i) => i.key));
  const done = keys.filter((k) => ctx.reviewed.has(k) || (requiredKeys.has(k) && isResolvedKey(k, ctx))).length;
  return { done, total: keys.length };
}

function isResolvedKey(key: string, ctx: ReviewContext): boolean {
  if (key === 'customer') return ctx.hasCustomer;
  return ctx.lineHasItem(key);
}

/** Result of comparing the document total with the live form total. */
export interface TotalsReconciliation {
  ok: boolean;
  /** formTotal - docTotal, in dollars (signed). */
  diff: number;
  /** Form line number whose amount is furthest from the document's. */
  suspectLine?: number;
}

/** Compares totals; when off, points at the line whose amount differs most. */
export function reconcileTotals(
  docTotal: number, formTotal: number, lines: HandoffLine[], formAmounts: Map<string, number>,
): TotalsReconciliation {
  const diff = Math.round((formTotal - docTotal) * CENTS) / CENTS;
  if (Math.abs(diff) < EPSILON) return { ok: true, diff: 0 };
  let suspect: number | undefined;
  let worst = EPSILON;
  lines.forEach((l) => {
    const formAmount = formAmounts.get(l.id);
    if (l.docAmount === null) return;
    const d = Math.abs((formAmount ?? 0) - l.docAmount);
    if (d > worst) { worst = d; suspect = l.lineNo; }
  });
  return { ok: false, diff, suspectLine: suspect };
}

/** Pills as they stand now: a "Pick item" pill becomes "Matched" once an item
 *  is chosen, and a price flag is added when the picked item's catalog price
 *  differs from the document's price. */
export function visiblePills(meta: HandoffLine, hasItem: boolean, pickedCatalogPrice: number | null, docPrice: number): LinePill[] {
  const base = meta.pills.filter((p) => !(hasItem && p.kind === 'pick_item'));
  if (meta.requiresItem && hasItem) {
    base.push({ kind: 'matched', label: 'Matched' });
    if (pickedCatalogPrice !== null && Math.round(pickedCatalogPrice * CENTS) !== Math.round(docPrice * CENTS)) {
      base.push({ kind: 'price_differs', label: `Price ≠ catalog $${pickedCatalogPrice.toFixed(2)}` });
    }
  }
  return base;
}
