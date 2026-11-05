import { useQuery } from '@tanstack/react-query';
import { itemReceiptService } from '@/services/itemReceiptService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { vendorBillService } from '@/services/vendorBillService';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import type { DerivedRecords } from '@/lib/derivedWorkflow';

/** Ids of the purchase records a page already holds. */
export interface PurchaseWorkflowLinks {
  purchaseOrderId?: string;
  vendorBillId?: string;
  vendorPaymentId?: string;
}

/** Resolves the purchase chain around a record from the links it holds:
 *  vendor payment, then its bill, then the bill's (or receipt's) purchase order,
 *  plus the receipts and payments hanging off them, so converting a purchase
 *  order into a receipt (or a bill) lights the next stage with no reload.
 *  The queries share their keys with the detail pages, so the same
 *  invalidations refresh the bar. */
export function usePurchaseDerivedWorkflow(links: PurchaseWorkflowLinks): DerivedRecords {
  const linkedPayment = useQuery({
    queryKey: ['vendor-payment', links.vendorPaymentId],
    queryFn: () => vendorPaymentService.getVendorPayment(links.vendorPaymentId ?? ''),
    enabled: Boolean(links.vendorPaymentId),
  });
  const billId = links.vendorBillId ?? linkedPayment.data?.applications[0]?.vendorBillId;
  const bill = useQuery({
    queryKey: ['vendor-bill', billId],
    queryFn: () => vendorBillService.getVendorBill(billId ?? ''),
    enabled: Boolean(billId),
  });
  const ledger = useQuery({
    queryKey: ['vendor-bill-payments', billId],
    queryFn: () => vendorBillService.getPayments(billId ?? ''),
    enabled: Boolean(billId) && !links.vendorPaymentId,
  });
  const ledgerPaymentId = ledger.data?.payments.at(-1)?.vendorPaymentId;
  const ledgerPayment = useQuery({
    queryKey: ['vendor-payment', ledgerPaymentId],
    queryFn: () => vendorPaymentService.getVendorPayment(ledgerPaymentId ?? ''),
    enabled: Boolean(ledgerPaymentId),
  });
  const purchaseOrderId = links.purchaseOrderId ?? bill.data?.purchaseOrder?.id;
  const order = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => purchaseOrderService.getPurchaseOrder(purchaseOrderId ?? ''),
    enabled: Boolean(purchaseOrderId),
  });
  const receipts = useQuery({
    queryKey: ['purchase-order-receipts', purchaseOrderId],
    queryFn: () => itemReceiptService.forPurchaseOrder(purchaseOrderId ?? ''),
    enabled: Boolean(purchaseOrderId),
  });

  const derived: DerivedRecords = {};
  const payment = linkedPayment.data ?? ledgerPayment.data;
  if (payment) {
    derived.vendorPayment = { id: payment.id, number: payment.vendorPaymentNumber, statusCode: payment.statusCode, status: payment.status };
  }
  if (bill.data) {
    derived.vendorBill = { id: bill.data.id, number: bill.data.vendorBillNumber, statusCode: bill.data.statusCode, status: bill.data.status };
  }
  if (order.data) {
    derived.purchaseOrder = { id: order.data.id, number: order.data.purchaseOrderNumber, statusCode: order.data.statusCode, status: order.data.status };
  }
  const receipt = receipts.data?.[0];
  if (receipt) {
    derived.receiving = { id: receipt.id, number: receipt.itemReceiptNumber, statusCode: receipt.statusCode, status: receipt.status };
  }
  return derived;
}
