import type { DocumentHandoffBase, HandoffParty } from '@/lib/documentHandoffShared';
import type { HandoffBadges } from '@/lib/salesOrderHandoffTypes';
import type { VendorBillLineItem } from '@/lib/vendorBillForm';
import type { LinkedPurchaseOrderLine } from '@/types/documentExtraction';
import type { VendorBillPurchaseOrderRef } from '@/types/vendorBill';

// Keys, labels and result type of the Vendor Bill document handoff
// (vendorBillDocumentHandoff.ts builds it).

/** Review keys of the Vendor Bill header fields that carry provenance. */
export const VB_HEADER_KEYS = {
  vendor: 'vendor',
  invoiceNumber: 'invoiceNumber',
  billDate: 'billDate',
  dueDate: 'dueDate',
  paymentTerms: 'paymentTerms',
  purchaseOrder: 'purchaseOrder',
  adjustment: 'adjustment',
  tax: 'tax',
} as const;

/** Human labels for the Vendor Bill header review keys. */
export const VB_HEADER_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  invoiceNumber: 'Vendor invoice number',
  billDate: 'Bill date',
  dueDate: 'Due date',
  paymentTerms: 'Payment terms',
  purchaseOrder: 'Purchase order',
  adjustment: 'Adjustment',
  tax: 'Sales tax',
};

/** The purchase order a bill is linked to and how its lines pair with the bill's. */
export interface BillPurchaseOrderLink {
  /** The PO to prefill the picker with; null when the bill is not linked. */
  ref: VendorBillPurchaseOrderRef | null;
  /** The PO's lines, for billing against them; empty unless the PO is billable. */
  lines: LinkedPurchaseOrderLine[];
  /** Bill line id -> PO line ids that fit it equally well (2+ means "pick one"). */
  candidates: Record<string, string[]>;
}

/** What a Vendor Bill review prefills the form with. */
export interface VendorBillHandoff extends DocumentHandoffBase {
  vendor: HandoffParty;
  /** Form `data` to merge over vendorBillDefaults(). */
  data: Record<string, unknown>;
  lineItems: VendorBillLineItem[];
  purchaseOrder: BillPurchaseOrderLink;
  /** Document grand total minus its tax, in dollars. */
  docTotal: number | null;
  docTax: number;
  badges: HandoffBadges;
}
