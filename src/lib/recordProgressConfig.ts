import type { AuditEntry } from '@/services/crmService';
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
import { salesOrderService } from '@/services/salesOrderService';
import { quoteService } from '@/services/quoteService';
import { estimateService } from '@/services/estimateService';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import { refundService } from '@/services/refundService';
import { creditMemoService } from '@/services/creditMemoService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { requisitionService } from '@/services/requisitionService';
import { vendorBillService } from '@/services/vendorBillService';
import { itemReceiptService } from '@/services/itemReceiptService';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { vendorCreditService } from '@/services/vendorCreditService';
import { expenseService } from '@/services/expenseService';

export interface RecordProgressConfig {
  title: string;
  catalog: StatusCatalogEntry[];
  /** Absent when the backend exposes no audit route (Fabrication Job): the
   *  card still shows the path, just without per-step dates. */
  fetchAudit?: (recordId: string) => Promise<AuditEntry[]>;
}

export const RECORD_PROGRESS_CONFIG: Record<ProgressModule, RecordProgressConfig> = {
  salesOrder: { title: 'Sales order progress', catalog: SO_STATUS_CODES, fetchAudit: salesOrderService.getAudit },
  quote: { title: 'Quote progress', catalog: QUOTE_STATUS_CODES, fetchAudit: quoteService.getAudit },
  estimate: { title: 'Estimate progress', catalog: ESTIMATE_STATUS_CODES, fetchAudit: estimateService.getAudit },
  invoice: { title: 'Invoice progress', catalog: INVOICE_STATUS_CODES, fetchAudit: invoiceService.getAudit },
  payment: { title: 'Payment progress', catalog: PAYMENT_STATUS_CODES, fetchAudit: paymentService.getAudit },
  refund: { title: 'Refund progress', catalog: REFUND_STATUS_CODES, fetchAudit: refundService.getAudit },
  creditMemo: { title: 'Credit memo progress', catalog: CREDIT_MEMO_STATUS_CODES, fetchAudit: creditMemoService.getAudit },
  fabrication: { title: 'Fabrication job progress', catalog: FJ_STATUS_CODES },
  purchaseOrder: { title: 'Purchase order progress', catalog: PO_STATUS_CODES, fetchAudit: purchaseOrderService.getAudit },
  requisition: { title: 'Requisition progress', catalog: REQUISITION_STATUS_CODES, fetchAudit: requisitionService.getAudit },
  vendorBill: { title: 'Vendor bill progress', catalog: VB_STATUS_CODES, fetchAudit: vendorBillService.getAudit },
  itemReceipt: { title: 'Item receipt progress', catalog: IR_STATUS_CODES, fetchAudit: itemReceiptService.getAudit },
  vendorPayment: { title: 'Vendor payment progress', catalog: VP_STATUS_CODES, fetchAudit: vendorPaymentService.getAudit },
  vendorCredit: { title: 'Vendor credit progress', catalog: VC_STATUS_CODES, fetchAudit: vendorCreditService.getAudit },
  expense: { title: 'Expense progress', catalog: EXPENSE_STATUS_CODES, fetchAudit: expenseService.getAudit },
};
