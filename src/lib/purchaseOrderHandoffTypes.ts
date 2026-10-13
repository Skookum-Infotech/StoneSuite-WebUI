import { ADDRESS_KEYS, ADDRESS_LABELS, type DocumentHandoffBase, type HandoffParty } from '@/lib/documentHandoffShared';
import type { HandoffBadges } from '@/lib/salesOrderHandoffTypes';
import type { PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';

// Keys, labels and result type of the Purchase Order document handoff
// (purchaseOrderDocumentHandoff.ts builds it).

/** Review keys of the Purchase Order header fields that carry provenance. */
export const PO_HEADER_KEYS = {
  vendor: 'vendor',
  referenceNumber: 'referenceNumber',
  orderDate: 'orderDate',
  expectedDate: 'expectedDate',
  paymentTerms: 'paymentTerms',
  shipTo: ADDRESS_KEYS.shipTo,
  shippingCharge: 'shippingCharge',
  adjustment: 'adjustment',
  tax: 'tax',
} as const;

/** Human labels for the Purchase Order header review keys. */
export const PO_HEADER_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  referenceNumber: 'Reference number',
  orderDate: 'Order date',
  expectedDate: 'Expected date',
  paymentTerms: 'Payment terms',
  shipTo: ADDRESS_LABELS.shipTo,
  shippingCharge: 'Shipping charge',
  adjustment: 'Adjustment (discount)',
  tax: 'Sales tax',
};

/** What a Purchase Order review prefills the form with. */
export interface PurchaseOrderHandoff extends DocumentHandoffBase {
  vendor: HandoffParty;
  /** Form `data` to merge over purchaseOrderDefaults(). */
  data: Record<string, unknown>;
  lineItems: PurchaseOrderLineItem[];
  /** Document grand total minus its tax, in dollars (StoneSuite computes tax itself). */
  docTotal: number | null;
  /** Tax the document charges, in dollars (0 when none). */
  docTax: number;
  badges: HandoffBadges;
}
