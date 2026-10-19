import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SegmentedProgressBar } from '@/components/tenant/SegmentedProgressBar';
import { showsReceivingProgress } from '@/lib/receivingProgress';
import type { PurchaseOrderSummary } from '@/types/purchaseOrder';
import { PurchaseOrderReceivingCard } from './PurchaseOrderReceivingCard';

type ReceivingProgressOrder = Pick<PurchaseOrderSummary, 'id' | 'purchaseOrderNumber' | 'statusCode' | 'receivedPercent'>;

/** The list row's "Received" cell: a segmented bar that opens the order's
 *  receiving card. Draft, pending, approved and cancelled orders have nothing
 *  to receive, so they show a dash — as does a row whose server has not sent a
 *  percent (a backend that predates the field). */
export function PurchaseOrderReceivingProgress({ order }: { order: ReceivingProgressOrder }) {
  const { receivedPercent } = order;
  if (receivedPercent === undefined || !showsReceivingProgress(order.statusCode)) {
    return <span className="text-2xs text-stone-300">—</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Receiving progress for ${order.purchaseOrderNumber}: ${receivedPercent}%. Show details`}
          className="-m-1 cursor-pointer rounded-md p-1 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <SegmentedProgressBar percent={receivedPercent} ariaLabel={`${order.purchaseOrderNumber} received`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-4">
        <PurchaseOrderReceivingCard orderId={order.id} />
      </PopoverContent>
    </Popover>
  );
}
