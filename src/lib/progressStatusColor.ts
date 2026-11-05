import type { ProgressModule } from '@/lib/orderProgress';
import { RECORD_PROGRESS_CONFIG } from '@/lib/recordProgressConfig';
import { SO_STATUS_COLORS } from '@/lib/salesOrderForm';
import { QUOTE_STATUS_COLORS } from '@/lib/quoteForm';
import { ESTIMATE_STATUS_COLORS } from '@/lib/estimateForm';
import { INVOICE_STATUS_COLORS } from '@/lib/invoiceForm';
import { PAYMENT_STATUS_COLORS } from '@/lib/paymentForm';
import { REFUND_STATUS_COLORS } from '@/lib/refundForm';
import { CREDIT_MEMO_STATUS_COLORS } from '@/lib/creditMemoForm';
import { FJ_STATUS_COLORS } from '@/lib/fabricationForm';
import { PO_STATUS_COLORS } from '@/lib/purchaseOrderForm';
import { REQUISITION_STATUS_COLORS } from '@/lib/requisitionForm';
import { VB_STATUS_COLORS } from '@/lib/vendorBillForm';
import { IR_STATUS_COLORS } from '@/lib/itemReceiptForm';
import { VP_STATUS_COLORS } from '@/lib/vendorPaymentForm';
import { VC_STATUS_COLORS } from '@/lib/vendorCreditForm';
import { EXPENSE_STATUS_COLORS } from '@/lib/expenseForm';

/** Neutral stone grey, the colour every module uses for Draft. */
export const NEUTRAL_STATUS_COLOR = '#a8a29e';

/** The status colour maps the pills already use. Some are keyed by the status
 *  label, some by the status code, so a lookup tries both. */
const COLOR_MAPS: Record<ProgressModule, Record<string, string>> = {
  salesOrder: SO_STATUS_COLORS,
  quote: QUOTE_STATUS_COLORS,
  estimate: ESTIMATE_STATUS_COLORS,
  invoice: INVOICE_STATUS_COLORS,
  payment: PAYMENT_STATUS_COLORS,
  refund: REFUND_STATUS_COLORS,
  creditMemo: CREDIT_MEMO_STATUS_COLORS,
  fabrication: FJ_STATUS_COLORS,
  purchaseOrder: PO_STATUS_COLORS,
  requisition: REQUISITION_STATUS_COLORS,
  vendorBill: VB_STATUS_COLORS,
  itemReceipt: IR_STATUS_COLORS,
  vendorPayment: VP_STATUS_COLORS,
  vendorCredit: VC_STATUS_COLORS,
  expense: EXPENSE_STATUS_COLORS,
};

/** The exact colour a document's status pill uses, for the hover panel's
 *  completed and current sub-statuses. */
export function progressStatusColor(module: ProgressModule, statusCode: string): string {
  const map = COLOR_MAPS[module];
  const label = RECORD_PROGRESS_CONFIG[module].catalog.find((s) => s.code === statusCode)?.label;
  return (label && map[label]) || map[statusCode] || NEUTRAL_STATUS_COLOR;
}
