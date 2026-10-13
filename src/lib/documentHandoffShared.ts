import type { FieldConfidence, FieldSource, MatchCandidate } from '@/types/documentExtraction';

// Party- and document-type-neutral pieces of a "create from document" handoff:
// review keys/items, provenance, line metadata and the resolved party. The Sales
// Order handoff (salesOrderHandoffTypes.ts) and the PO / Vendor Bill handoffs
// build on these.

/** Review keys of the address blocks (shared by every document type). */
export const ADDRESS_KEYS = { billTo: 'billTo', shipTo: 'shipTo' } as const;

/** Human labels of the address review keys. */
export const ADDRESS_LABELS: Record<string, string> = { billTo: 'Bill to', shipTo: 'Ship to' };

/** Review key of the doc line at a 1-based form line number. */
export function lineReviewKey(lineNo: number): string {
  return `line:${lineNo}`;
}

/** Stable form-line id for an extracted line index. */
export function docLineId(docIndex: number): string {
  return `doc-line-${docIndex}`;
}

/** Where a value came from, shown in the provenance popover. */
export interface ProvenanceInfo {
  /** The value as the document states it. */
  value?: string;
  source: FieldSource;
  confidence: FieldConfidence;
  snippet?: string;
  page?: number;
  row?: number;
}

/** One thing the reviewer should look at; `required` blocks Save until resolved. */
export interface ReviewItem {
  key: string;
  label: string;
  reason: string;
  required: boolean;
  /** Resolved only by "Mark reviewed" — even a required line item, which is
   *  otherwise resolved by picking a catalog item. */
  resolvedByReview?: boolean;
  /** A way out of the screen, shown beside the reason (e.g. "create a Sales
   *  Order instead" for a customer's PO uploaded as a purchase order). */
  link?: { to: string; label: string };
}

export type LinePillKind = 'matched' | 'learned' | 'pick_item' | 'addon' | 'converted' | 'price_differs';

export interface LinePill {
  kind: LinePillKind;
  label: string;
}

/** Review-side metadata for one form line created from the document. */
export interface HandoffLine {
  /** Matches the form line item's id. */
  id: string;
  docIndex: number;
  lineNo: number;
  docSku: string;
  docDescription: string;
  /** The document's own text for the line, kept visible under the item picker. */
  docText: string;
  /** Line amount on the document in dollars, or null when it had none. */
  docAmount: number | null;
  /** The document's own unit and quantity for the line ('' / null when absent). */
  docUom: string;
  docQty: number | null;
  parentLineNo?: number;
  pills: LinePill[];
  requiresItem: boolean;
  /** Original (pre-conversion) document unit and quantity, when converted. */
  conversionNote?: string;
}

/** The counterparty the server resolved (a customer, or a vendor). */
export interface HandoffParty {
  resolved: { id: string; name: string } | null;
  extractedText: string;
  candidates: MatchCandidate[];
  /** True when the match exists but the party is inactive. */
  inactive: boolean;
}

/** The slice of any document handoff that the generic review lifecycle reads. */
export interface DocumentHandoffBase {
  lines: HandoffLine[];
  provenance: Record<string, ProvenanceInfo>;
  reviewItems: ReviewItem[];
}

/** The line rows /complete learns from: lines that came from the document and
 *  ended up with a catalog item. */
export function savedLines(
  lines: HandoffLine[], lineItems: ReadonlyArray<{ id: string; inventoryItemUuid?: string }>,
): Array<{ docSku: string; docDescription: string; itemUuid: string }> {
  const byId = new Map(lineItems.map((l) => [l.id, l]));
  return lines.flatMap((l) => {
    const itemUuid = byId.get(l.id)?.inventoryItemUuid;
    return itemUuid ? [{ docSku: l.docSku, docDescription: l.docDescription, itemUuid }] : [];
  });
}
