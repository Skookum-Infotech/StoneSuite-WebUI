import type { SOLineItem } from '@/lib/salesOrderForm';
import { ADDRESS_KEYS, ADDRESS_LABELS, type HandoffLine, type HandoffParty, type ProvenanceInfo, type ReviewItem } from '@/lib/documentHandoffShared';

// Shared keys, labels and result types of the Sales Order document handoff
// (split out of salesOrderDocumentHandoff.ts, which re-exports all of it).

/** Review keys of the header fields that carry provenance. */
export const HEADER_KEYS = {
  customer: 'customer',
  poNumber: 'poNumber',
  orderDate: 'orderDate',
  expectedDelivery: 'expectedDelivery',
  paymentTerms: 'paymentTerms',
  ...ADDRESS_KEYS,
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
  ...ADDRESS_LABELS,
  shippingCharge: 'Shipping charge',
  adjustment: 'Adjustment (discount)',
  tax: 'Sales tax',
};

export type { HandoffLine, LinePill, LinePillKind, ProvenanceInfo, ReviewItem } from '@/lib/documentHandoffShared';
export { docLineId, lineReviewKey } from '@/lib/documentHandoffShared';

/** The resolved customer of a Sales Order handoff. */
export type HandoffCustomer = HandoffParty;

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
  /** The document has no title, table, PO number or customer (not a PO at all). */
  notRecognized: boolean;
  /** Replaces the default "Not a purchase order?" badge text. */
  notRecognizedLabel?: string;
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
  /** Tax the document charges, in dollars (0 when none). */
  docTax: number;
  badges: HandoffBadges;
}
