import type { VendorBill } from '@/types/vendorBill';
import { resetCopiedFields } from './recordCopy';
import { fromVendorBill, vendorBillDefaults } from './vendorBillForm';

/** What a copied bill must not inherit: its number and status, the vendor's
 *  invoice number (a second bill carrying it is rejected as a duplicate), dates
 *  that would be stale, and the owner. */
const VENDOR_BILL_COPY_RESET_FIELDS = [
  'vb_status', 'vb_doc_num', 'vendor_invoice_number', 'bill_date', 'due_date', 'owner_employee',
] as const;

/** The Add Vendor Bill form's starting state for "Copy vendor bill". */
export function fromVendorBillForCopy(bill: VendorBill): ReturnType<typeof fromVendorBill> {
  const mapped = fromVendorBill(bill);
  return {
    ...mapped,
    data: resetCopiedFields(mapped.data, vendorBillDefaults(), VENDOR_BILL_COPY_RESET_FIELDS),
    // The original's purchase order, and the lines billed against it, stay with it.
    purchaseOrder: null,
    lineItems: mapped.lineItems.map((line) => ({ ...line, purchaseOrderItemId: undefined })),
  };
}
