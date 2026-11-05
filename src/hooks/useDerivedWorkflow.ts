import { useQuery } from '@tanstack/react-query';
import { salesOrderService } from '@/services/salesOrderService';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import { mergeWorkflow, type DerivedRecords } from '@/lib/derivedWorkflow';
import type { WorkflowBlock } from '@/types/workflow';

/** Links a page already holds on its own record. */
export interface WorkflowLinks {
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

  const derived: DerivedRecords = {};
  if (payment.data) {
    derived.payment = { id: payment.data.id, number: payment.data.paymentNumber, statusCode: payment.data.statusCode, status: payment.data.status };
  }
  if (invoice.data) {
    derived.invoice = { id: invoice.data.id, number: invoice.data.invoiceNumber, statusCode: invoice.data.statusCode, status: invoice.data.status };
  }
  if (order.data) {
    derived.salesOrder = { id: order.data.id, number: order.data.salesOrderNumber, statusCode: order.data.statusCode, status: order.data.status };
  }
  return mergeWorkflow(server, derived);
}
