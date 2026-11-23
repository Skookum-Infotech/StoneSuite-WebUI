import type { SalesOrder } from '@/types/salesOrder';
import { resetCopiedFields } from './recordCopy';
import { fromOrder, soDefaults } from './salesOrderForm';

/** What a copied order must not inherit: its number and status, the customer's
 *  PO number (a second order carrying it is rejected as a duplicate), dates that
 *  would be stale, and the owner (whoever saves the copy owns it). */
const SO_COPY_RESET_FIELDS = [
  'sales_order_status', 'sales_doc_num', 'purchase_doc_num',
  'date_created', 'scheduled_install_date', 'payment_due_date', 'customer_owner',
] as const;

/** The Add Sales Order form's starting state for "Copy sales order". */
export function fromOrderForCopy(order: SalesOrder): ReturnType<typeof fromOrder> {
  const mapped = fromOrder(order);
  return {
    ...mapped,
    data: resetCopiedFields(mapped.data, soDefaults(), SO_COPY_RESET_FIELDS),
    // Fulfilment belongs to the original order; the copy's lines start open.
    lineItems: mapped.lineItems.map((line) => ({ ...line, fulfilledQuantity: undefined, status: undefined })),
  };
}
