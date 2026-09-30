import { Lock, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { allocationOf } from '@/lib/unitAllocation';
import type { InventoryUnit } from '@/types/inventory';
import { UnitAllocationChips } from './UnitAllocationChips';

// A strip under the slab page's header, on every tab, that says whose stone this
// is: reserved for (amber, still whole) or cut for (grey, gone) a customer order.
// Renders nothing for a slab no job has claimed.
export function UnitAllocationBanner({ unit }: { unit: InventoryUnit }) {
  const allocation = allocationOf(unit);
  if (!allocation) return null;

  const Icon = allocation.held ? Lock : Scissors;
  return (
    <div
      role="region"
      aria-label="Slab allocation"
      className={cn(
        'shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2.5 3xl:px-12 4xl:px-16',
        allocation.held ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-100',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', allocation.held ? 'text-amber-800' : 'text-stone-700')}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {allocation.held ? 'Reserved for' : 'Cut for'}
      </span>
      <UnitAllocationChips unit={unit} />
    </div>
  );
}
