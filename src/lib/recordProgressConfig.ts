import type { ProgressModule, StatusCatalogEntry } from '@/lib/orderProgress';
import { SO_STATUS_CODES } from '@/lib/salesOrderForm';
import { QUOTE_STATUS_CODES } from '@/lib/quoteForm';
import { ESTIMATE_STATUS_CODES } from '@/lib/estimateForm';
import { INVOICE_STATUS_CODES } from '@/lib/invoiceForm';
import { PAYMENT_STATUS_CODES } from '@/lib/paymentForm';
import { REFUND_STATUS_CODES } from '@/lib/refundForm';
import { CREDIT_MEMO_STATUS_CODES } from '@/lib/creditMemoForm';
import { FJ_STATUS_CODES } from '@/lib/fabricationForm';
import { PO_STATUS_CODES } from '@/lib/purchaseOrderForm';
import { REQUISITION_STATUS_CODES } from '@/lib/requisitionForm';
import { VB_STATUS_CODES } from '@/lib/vendorBillForm';
import { IR_STATUS_CODES } from '@/lib/itemReceiptForm';
import { VP_STATUS_CODES } from '@/lib/vendorPaymentForm';
import { VC_STATUS_CODES } from '@/lib/vendorCreditForm';
import { EXPENSE_STATUS_CODES } from '@/lib/expenseForm';

export interface RecordProgressConfig {
  catalog: StatusCatalogEntry[];
}

/** The status catalog each document's hover panel reads its step labels from. */
export const RECORD_PROGRESS_CONFIG: Record<ProgressModule, RecordProgressConfig> = {
  salesOrder: { catalog: SO_STATUS_CODES },
  quote: { catalog: QUOTE_STATUS_CODES },
  estimate: { catalog: ESTIMATE_STATUS_CODES },
  invoice: { catalog: INVOICE_STATUS_CODES },
  payment: { catalog: PAYMENT_STATUS_CODES },
  refund: { catalog: REFUND_STATUS_CODES },
  creditMemo: { catalog: CREDIT_MEMO_STATUS_CODES },
  fabrication: { catalog: FJ_STATUS_CODES },
  purchaseOrder: { catalog: PO_STATUS_CODES },
  requisition: { catalog: REQUISITION_STATUS_CODES },
  vendorBill: { catalog: VB_STATUS_CODES },
  itemReceipt: { catalog: IR_STATUS_CODES },
  vendorPayment: { catalog: VP_STATUS_CODES },
  vendorCredit: { catalog: VC_STATUS_CODES },
  expense: { catalog: EXPENSE_STATUS_CODES },
};
