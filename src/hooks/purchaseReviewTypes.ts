import type { PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';
import type { VendorBillLineItem } from '@/lib/vendorBillForm';
import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import type { VendorBillPurchaseOrderRef } from '@/types/vendorBill';

/** A write to a page's form state; `data` may be an updater so it composes with
 *  other functional updates. */
export type ReviewPatchOf<F extends { data: Record<string, unknown> }> = Omit<Partial<F>, 'data'> & {
  data?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>);
};

/** Purchase Order and Vendor Bill reviews keep no header values outside the form. */
export type NoExtras = Record<string, never>;

/** The Add Purchase Order page's form state that review mode reads and writes. */
export interface PurchaseOrderReviewForm {
  data: Record<string, unknown>;
  lineItems: PurchaseOrderLineItem[];
  vendor: VendorRef | null;
  customFieldValues: Record<string, unknown>;
}

/** The Add Vendor Bill page's form state that review mode reads and writes. */
export interface VendorBillReviewForm {
  data: Record<string, unknown>;
  lineItems: VendorBillLineItem[];
  vendor: VendorRef | null;
  purchaseOrder: VendorBillPurchaseOrderRef | null;
  customFieldValues: Record<string, unknown>;
}

export type PurchaseOrderReviewPatch = ReviewPatchOf<PurchaseOrderReviewForm>;
export type VendorBillReviewPatch = ReviewPatchOf<VendorBillReviewForm>;
