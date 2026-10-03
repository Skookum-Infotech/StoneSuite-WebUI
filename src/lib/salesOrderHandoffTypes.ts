import type { SOLineItem } from '@/lib/salesOrderForm';
import type { FieldConfidence, FieldSource, MatchCandidate } from '@/types/documentExtraction';

// Shared keys, labels and result types of the Sales Order document handoff
// (split out of salesOrderDocumentHandoff.ts, which re-exports all of it).

/** Review keys of the header fields that carry provenance. */
export const HEADER_KEYS = {
  customer: 'customer',
  poNumber: 'poNumber',
  orderDate: 'orderDate',
  expectedDelivery: 'expectedDelivery',
  paymentTerms: 'paymentTerms',
  billTo: 'billTo',
  shipTo: 'shipTo',
  shippingCharge: 'shippingCharge',
  adjustment: 'adjustment',
  tax: 'tax',
} as const;

/** Human labels for header review keys. */
export const HEADER_LABELS: Record<string, string> = {
  customer: 'Customer',
  poNumber: 'PO number',
  orderDate: 'Order date',
  expectedDelivery: 'Expected delivery',
  paymentTerms: 'Payment terms',
  billTo: 'Bill to',
  shipTo: 'Ship to',
  shippingCharge: 'Shipping charge',
  adjustment: 'Adjustment (discount)',
  tax: 'Sales tax',
};

/** Review key of the doc line at a 1-based form line number. */
export function lineReviewKey(lineNo: number): string {
  return `line:${lineNo}`;
}

/** Stable SOLineItem id for an extracted line index. */
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
}

export type LinePillKind = 'matched' | 'learned' | 'pick_item' | 'addon' | 'converted' | 'price_differs';

export interface LinePill {
  kind: LinePillKind;
  label: string;
}

/** Review-side metadata for one form line created from the document. */
export interface HandoffLine {
  /** Matches the SOLineItem id. */
  id: string;
  docIndex: number;
  lineNo: number;
  docSku: string;
  docDescription: string;
  /** The document's own text for the line, kept visible under the item picker. */
  docText: string;
  /** Line amount on the document in dollars, or null when it had none. */
  docAmount: number | null;
  parentLineNo?: number;
  pills: LinePill[];
  requiresItem: boolean;
  /** Original (pre-conversion) document unit and quantity, when converted. */
  conversionNote?: string;
}

export interface HandoffCustomer {
  resolved: { id: string; name: string } | null;
  extractedText: string;
  candidates: MatchCandidate[];
  /** True when the match exists but the customer is inactive. */
  inactive: boolean;
}

/** Header values the form has no input for; sent with the create payload. */
export interface HandoffExtras {
  expectedDelivery: string;
  shippingCharge: number;
  adjustment: number;
}

export interface HandoffBadges {
  signed: boolean;
  revision: string;
  convertedUnits: boolean;
  wrongType: string;
}

export interface SalesOrderHandoff {
  customer: HandoffCustomer;
  /** Form `data` to merge over soDefaults(). */
  data: Record<string, unknown>;
  extras: HandoffExtras;
  lineItems: SOLineItem[];
  lines: HandoffLine[];
  provenance: Record<string, ProvenanceInfo>;
  reviewItems: ReviewItem[];
  /** Document grand total minus its tax, in dollars (StoneSuite computes tax
   *  itself), or null when the total wasn't found. */
  docTotal: number | null;
  badges: HandoffBadges;
}
