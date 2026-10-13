import type { ReviewFieldConfig } from '@/hooks/documentReviewView';
import { HEADER_KEYS as SO_KEYS, HEADER_LABELS as SO_LABELS } from '@/lib/salesOrderHandoffTypes';
import { PO_HEADER_KEYS, PO_HEADER_LABELS } from '@/lib/purchaseOrderHandoffTypes';
import { VB_HEADER_KEYS, VB_HEADER_LABELS } from '@/lib/vendorBillHandoffTypes';

const CUSTOMER_SEARCH = 'input[aria-label="Search billing customer"], button[aria-label="Change billing customer"]';
const VENDOR_SEARCH = 'input[aria-label="Search vendor"], button[aria-label="Change vendor"]';

/** The Sales Order review field rows, in display order. */
export const SALES_ORDER_REVIEW_FIELDS: ReviewFieldConfig = {
  order: [
    SO_KEYS.customer, SO_KEYS.poNumber, SO_KEYS.orderDate, SO_KEYS.expectedDelivery, SO_KEYS.paymentTerms,
    SO_KEYS.billTo, SO_KEYS.shipTo, SO_KEYS.shippingCharge, SO_KEYS.adjustment, SO_KEYS.tax,
  ],
  labels: SO_LABELS,
  partyKey: SO_KEYS.customer,
  partySearchSelector: CUSTOMER_SEARCH,
};

/** The Purchase Order review field rows, in display order. */
export const PURCHASE_ORDER_REVIEW_FIELDS: ReviewFieldConfig = {
  order: [
    PO_HEADER_KEYS.vendor, PO_HEADER_KEYS.referenceNumber, PO_HEADER_KEYS.orderDate, PO_HEADER_KEYS.expectedDate,
    PO_HEADER_KEYS.paymentTerms, PO_HEADER_KEYS.shipTo, PO_HEADER_KEYS.shippingCharge, PO_HEADER_KEYS.adjustment,
    PO_HEADER_KEYS.tax,
  ],
  labels: PO_HEADER_LABELS,
  partyKey: PO_HEADER_KEYS.vendor,
  partySearchSelector: VENDOR_SEARCH,
};

/** The Vendor Bill review field rows, in display order. */
export const VENDOR_BILL_REVIEW_FIELDS: ReviewFieldConfig = {
  order: [
    VB_HEADER_KEYS.vendor, VB_HEADER_KEYS.invoiceNumber, VB_HEADER_KEYS.billDate, VB_HEADER_KEYS.dueDate,
    VB_HEADER_KEYS.paymentTerms, VB_HEADER_KEYS.purchaseOrder, VB_HEADER_KEYS.adjustment, VB_HEADER_KEYS.tax,
  ],
  labels: VB_HEADER_LABELS,
  partyKey: VB_HEADER_KEYS.vendor,
  partySearchSelector: VENDOR_SEARCH,
};
