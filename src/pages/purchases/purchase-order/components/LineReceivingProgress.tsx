import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReceivingProgressCard } from '@/components/tenant/ReceivingProgressCard';
import { SegmentedProgressBar } from '@/components/tenant/SegmentedProgressBar';
import { buildLineCardModel, lineName } from '@/lib/receivingCardModel';
import { linePercent } from '@/lib/receivingProgress';
import type { PurchaseOrderLine } from '@/types/purchaseOrder';

/** A line's "Received" cell on the Items tab: a segmented bar that opens a
 *  card scoped to that one line (the line is already in hand, so no fetch). */
export function LineReceivingProgress({ line }: { line: PurchaseOrderLine }) {
  const percent = linePercent(line.qtyReceived, line.quantity);
  const name = lineName(line);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Receiving progress for ${name}: ${percent}%. Show details`}
          className="-m-1 cursor-pointer rounded-md p-1 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <SegmentedProgressBar percent={percent} ariaLabel={`${name} received`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-4">
        <ReceivingProgressCard model={buildLineCardModel(line)} />
      </PopoverContent>
    </Popover>
  );
}
