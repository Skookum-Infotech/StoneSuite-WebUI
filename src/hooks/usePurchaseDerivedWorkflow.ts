import { useQuery } from '@tanstack/react-query';
import { itemReceiptService } from '@/services/itemReceiptService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { requisitionService } from '@/services/requisitionService';
import { vendorBillService } from '@/services/vendorBillService';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import type { DerivedRecords } from '@/lib/derivedWorkflow';
import type { WorkflowRecordRef } from '@/types/workflow';

/** Ids of the purchase records a page already holds. */
export interface PurchaseWorkflowLinks {
  purchaseOrderId?: string;
  vendorBillId?: string;
  vendorPaymentId?: string;
}

const ORDER_BILLS_LIMIT = 50;

/** Resolves the purchase chain around a record from the links it holds:
 *  vendor payment, then its bill, then the bill's (or receipt's) purchase order,
 *  plus every receipt and bill hanging off the order and the payments off the
 *  bill, so a purchase order's own page shows the stages downstream of it and
 *  converting it into a receipt (or a bill) lights the next stage with no reload.
 *  The queries share their keys with the detail pages, so the same
 *  invalidations refresh the bar. */
export function usePurchaseDerivedWorkflow(links: PurchaseWorkflowLinks): DerivedRecords {
  const linkedPayment = useQuery({
    queryKey: ['vendor-payment', links.vendorPaymentId],
    queryFn: () => vendorPaymentService.getVendorPayment(links.vendorPaymentId ?? ''),
    enabled: Boolean(links.vendorPaymentId),
  });
  const linkedBillId = links.vendorBillId ?? linkedPayment.data?.applications[0]?.vendorBillId;
  const linkedBill = useQuery({
    queryKey: ['vendor-bill', linkedBillId],
    queryFn: () => vendorBillService.getVendorBill(linkedBillId ?? ''),
    enabled: Boolean(linkedBillId),
  });
  const purchaseOrderId = links.purchaseOrderId ?? linkedBill.data?.purchaseOrder?.id;
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
  // A purchase order cannot list its bills, and the search cannot filter by the
  // order's id, so search by its number and keep the bills that point back at it.
  const orderNumber = order.data?.purchaseOrderNumber;
  const orderBills = useQuery({
    queryKey: ['vendor-bills', 'of-purchase-order', purchaseOrderId, orderNumber],
    queryFn: async () => {
      const page = await vendorBillService.searchVendorBills({
        search: orderNumber,
        sort: [{ field: 'created_at', dir: 'asc' }],
        limit: ORDER_BILLS_LIMIT,
      });
      return page.records.filter((b) => b.purchaseOrder?.id === purchaseOrderId);
    },
    enabled: Boolean(purchaseOrderId) && Boolean(orderNumber) && !linkedBillId,
  });
  // A converted requisition stores the order's id but the order does not point
  // back, so search by the order's vendor and keep the requisition that
  // converted into it. Works for orders converted before this lookup existed.
  const vendorName = order.data?.vendor?.name;
  const sourceRequisition = useQuery({
    queryKey: ['requisitions', 'of-purchase-order', purchaseOrderId, vendorName],
    queryFn: async () => {
      const page = await requisitionService.searchRequisitions({
        search: vendorName,
        sort: [{ field: 'created_at', dir: 'asc' }],
        limit: ORDER_BILLS_LIMIT,
      });
      return page.records.filter((r) => r.convertedPurchaseOrderId === purchaseOrderId);
    },
    enabled: Boolean(purchaseOrderId) && Boolean(vendorName),
  });
  const billId = linkedBillId ?? orderBills.data?.[0]?.id;
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

  const derived: DerivedRecords = {};
  const payment = linkedPayment.data ?? ledgerPayment.data;
  if (payment) {
    derived.vendorPayment = { id: payment.id, number: payment.vendorPaymentNumber, statusCode: payment.statusCode, status: payment.status };
  }
  const bills: WorkflowRecordRef[] = [];
  if (linkedBill.data) {
    bills.push({ id: linkedBill.data.id, number: linkedBill.data.vendorBillNumber, statusCode: linkedBill.data.statusCode, status: linkedBill.data.status });
  }
  (orderBills.data ?? []).forEach((b) => {
    bills.push({ id: b.id, number: b.vendorBillNumber, statusCode: b.statusCode, status: b.status });
  });
  if (bills.length) derived.vendorBill = bills;
  if (order.data) {
    derived.purchaseOrder = { id: order.data.id, number: order.data.purchaseOrderNumber, statusCode: order.data.statusCode, status: order.data.status };
  }
  if (sourceRequisition.data?.length) {
    derived.requisition = sourceRequisition.data.map((r) => ({ id: r.id, number: r.requisitionNumber, statusCode: r.statusCode, status: r.status }));
  }
  if (receipts.data?.length) {
    derived.receiving = receipts.data.map((r) => ({ id: r.id, number: r.itemReceiptNumber, statusCode: r.statusCode, status: r.status }));
  }
  return derived;
}
