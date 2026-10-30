import type { ItemReceiptLine } from '@/types/itemReceipt';
import { ReceiptLineSlabs } from './ReceiptLineSlabs';

// The slabs a receipt brought (or, while it is still pending, will bring) into
// Inventory, grouped by the line they arrived on.
export function ReceiptSlabsTable({ lines }: { lines: ItemReceiptLine[] }) {
  const slabLines = lines.filter((l) => (l.slabs?.length ?? 0) > 0);
  if (slabLines.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Slabs received</h3>
      {slabLines.map((line) => <ReceiptLineSlabs key={line.id} line={line} />)}
    </div>
  );
}
