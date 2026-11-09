import { useQuery } from '@tanstack/react-query';
import { fabricationService } from '@/services/fabricationService';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import type { DerivedRecords } from '@/lib/derivedWorkflow';

const DOWNSTREAM_LIMIT = 50;

/** The sales order's own identity, as read from its detail response. */
export interface SalesOrderIdentity {
  id?: string;
  number?: string;
  customerName?: string;
}

/** Finds the invoices, fabrication jobs and payments raised from a sales order. The order
 *  cannot list them and the searches cannot filter by its id, so each is searched
 *  by a term it does carry (the order number on an invoice, the customer name on
 *  a job or payment) and only records that point back at this order (or at one of
 *  its invoices) are kept. */
export function useSalesOrderDownstream(order: SalesOrderIdentity): DerivedRecords {
  const invoices = useQuery({
    queryKey: ['invoices', 'of-sales-order', order.id, order.number],
    queryFn: async () => {
      const page = await invoiceService.searchInvoices({
        search: order.number,
        sort: [{ field: 'created_at', dir: 'asc' }],
        limit: DOWNSTREAM_LIMIT,
      });
      return page.records.filter((i) => i.salesOrder?.id === order.id);
    },
    enabled: Boolean(order.id) && Boolean(order.number),
  });
  const jobs = useQuery({
    queryKey: ['fabrication-jobs', 'of-sales-order', order.id, order.customerName],
    queryFn: async () => {
      const page = await fabricationService.searchJobs({
        search: order.customerName,
        sort: [{ field: 'created_at', dir: 'asc' }],
        limit: DOWNSTREAM_LIMIT,
      });
      return page.records.filter((j) => j.salesOrderId === order.id);
    },
    enabled: Boolean(order.id) && Boolean(order.customerName),
  });

  const invoiceIds = (invoices.data ?? []).map((i) => i.id);
  const payments = useQuery({
    queryKey: ['payments', 'of-sales-order', order.id, order.customerName, invoiceIds],
    queryFn: async () => {
      const page = await paymentService.searchPayments({
        search: order.customerName,
        sort: [{ field: 'created_at', dir: 'asc' }],
        limit: DOWNSTREAM_LIMIT,
      });
      return page.records.filter((p) => p.applications?.some((a) => invoiceIds.includes(a.invoiceId)));
    },
    enabled: Boolean(order.customerName) && invoiceIds.length > 0,
  });

  const derived: DerivedRecords = {};
  if (invoices.data?.length) {
    derived.invoice = invoices.data.map((i) => ({ id: i.id, number: i.invoiceNumber, statusCode: i.statusCode, status: i.status }));
  }
  if (jobs.data?.length) {
    derived.fabrication = jobs.data.map((j) => ({ id: j.id, number: j.jobNumber, statusCode: j.statusCode, status: j.status }));
  }
  if (payments.data?.length) {
    derived.payment = payments.data.map((p) => ({ id: p.id, number: p.paymentNumber, statusCode: p.statusCode, status: p.status }));
  }
  return derived;
}
