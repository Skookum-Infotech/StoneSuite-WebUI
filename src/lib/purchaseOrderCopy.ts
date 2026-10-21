import type { PurchaseOrder } from '@/types/purchaseOrder';
import { resetCopiedFields } from './recordCopy';
import { fromPurchaseOrder, purchaseOrderDefaults } from './purchaseOrderForm';

/** What a copied purchase order must not inherit: its number and status, dates
 *  that would be stale, and the owner. */
const PO_COPY_RESET_FIELDS = ['po_status', 'po_doc_num', 'order_date', 'expected_date', 'owner_employee'] as const;

/** The Add Purchase Order form's starting state for "Copy purchase order". */
export function fromPurchaseOrderForCopy(po: PurchaseOrder): ReturnType<typeof fromPurchaseOrder> {
  const mapped = fromPurchaseOrder(po);
  return { ...mapped, data: resetCopiedFields(mapped.data, purchaseOrderDefaults(), PO_COPY_RESET_FIELDS) };
}
