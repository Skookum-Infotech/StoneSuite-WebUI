import { useQuery } from '@tanstack/react-query';
import { salesOrderService } from '@/services/salesOrderService';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import { mergeWorkflow, type DerivedRecords } from '@/lib/derivedWorkflow';
import { useSalesOrderDownstream } from '@/hooks/useSalesOrderDownstream';
import { usePurchaseDerivedWorkflow, type PurchaseWorkflowLinks } from '@/hooks/usePurchaseDerivedWorkflow';
import type { WorkflowBlock } from '@/types/workflow';

/** Links a page already holds on its own record. */
export interface WorkflowLinks extends PurchaseWorkflowLinks {
  salesOrderId?: string;
  invoiceId?: string;
  paymentId?: string;
}

/** Resolves the upstream chain (payment, then invoice, then sales order) from a
 *  record's own links, so the Progress Bar shows "Sales order, then Invoice"
 *  even when the server's `workflow` block is missing. The fetches share their
 *  query keys with the detail pages, so they are cached and refreshed by the
 *  same invalidation. Server data always wins in the merge. */
export function useDerivedWorkflow(links: WorkflowLinks, server?: WorkflowBlock): WorkflowBlock {
  const payment = useQuery({
    queryKey: ['payment', links.paymentId],
    queryFn: () => paymentService.getPayment(links.paymentId ?? ''),
    enabled: Boolean(links.paymentId),
  });
  const invoiceId = links.invoiceId ?? payment.data?.applications[0]?.invoiceId;
  const invoice = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoiceService.getInvoice(invoiceId ?? ''),
    enabled: Boolean(invoiceId),
  });
  const salesOrderId = links.salesOrderId ?? invoice.data?.salesOrder?.id;
  const order = useQuery({
    queryKey: ['sales-order', salesOrderId],
    queryFn: () => salesOrderService.getOrder(salesOrderId ?? ''),
    enabled: Boolean(salesOrderId),
  });

  const purchaseDerived = usePurchaseDerivedWorkflow(links);
  const downstream = useSalesOrderDownstream({ id: order.data?.id, number: order.data?.salesOrderNumber, customerName: order.data?.customer?.name });
  const derived: DerivedRecords = {};
  if (payment.data) {
    derived.payment = { id: payment.data.id, number: payment.data.paymentNumber, statusCode: payment.data.statusCode, status: payment.data.status };
  }
  const otherPayments = Array.isArray(downstream.payment) ? downstream.payment : [];
  if (otherPayments.length) {
    const own = derived.payment && !Array.isArray(derived.payment) ? [derived.payment] : [];
    derived.payment = [...own, ...otherPayments.filter((p) => p.id !== own[0]?.id)];
  }
  if (invoice.data) {
    derived.invoice = { id: invoice.data.id, number: invoice.data.invoiceNumber, statusCode: invoice.data.statusCode, status: invoice.data.status };
  }
  const siblings = Array.isArray(downstream.invoice) ? downstream.invoice : [];
  if (siblings.length) {
    const own = derived.invoice && !Array.isArray(derived.invoice) ? [derived.invoice] : [];
    derived.invoice = [...own, ...siblings.filter((s) => s.id !== own[0]?.id)];
  }
  if (order.data) {
    derived.salesOrder = { id: order.data.id, number: order.data.salesOrderNumber, statusCode: order.data.statusCode, status: order.data.status };
  }
  return mergeWorkflow(server, { ...downstream, ...derived, ...purchaseDerived });
}
