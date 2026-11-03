import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { ReceivingProgressCard } from '@/components/tenant/ReceivingProgressCard';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { itemReceiptService } from '@/services/itemReceiptService';
import { buildOrderCardModel } from '@/lib/receivingCardModel';
import { toISODate } from '@/lib/dateUtils';

/** The receiving card for a whole order, mounted only while its popover is
 *  open. The list row carries just the order's %, so the lines and receipts
 *  are loaded here on demand — under the same query keys the detail page and
 *  its Receipts tab use, so they share a cache. */
export function PurchaseOrderReceivingCard({ orderId }: { orderId: string }) {
  const order = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => purchaseOrderService.getPurchaseOrder(orderId),
  });
  const receipts = useQuery({
    queryKey: ['purchase-order-receipts', orderId],
    queryFn: () => itemReceiptService.forPurchaseOrder(orderId),
  });

  if (order.isError) {
    return <ErrorNote>{apiErrorMessage(order.error, 'Failed to load receiving details.')}</ErrorNote>;
  }
  if (!order.data) return <Spinner label="Loading receiving details…" />;

  // A receipts failure is not fatal: the card still has the lines, and simply
  // leaves out the receipts line instead of claiming nothing was received.
  const model = buildOrderCardModel(order.data, receipts.data, toISODate(new Date()));
  return <ReceivingProgressCard model={model} />;
}
