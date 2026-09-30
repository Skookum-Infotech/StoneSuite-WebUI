import { ShoppingCart, Wrench } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { allocationOf, allocationSentence, fabricationJobPath, salesOrderPath } from '@/lib/unitAllocation';
import type { InventoryUnit } from '@/types/inventory';
import { UnitAllocationChip } from './UnitAllocationChip';

// The sales order and fabrication job a slab is allocated to, as two links. Shown
// in the Inventory list's Allocated To column and in the slab page's banner.
// Renders nothing for a slab no job has claimed.
export function UnitAllocationChips({ unit }: { unit: InventoryUnit }) {
  const { hasPermission, isLoading } = useUserPermissions();
  const allocation = allocationOf(unit);
  if (!allocation) return null;

  // Opening a record needs its own read grant; without it the chip is a label.
  const canOpenOrder = isLoading || hasPermission('sales_order', 'read');
  const canOpenJob = isLoading || hasPermission('installation', 'read');

  return (
    <div className="flex flex-wrap items-center gap-1.5" title={allocationSentence(unit)}>
      {allocation.salesOrderId && (
        <UnitAllocationChip
          icon={ShoppingCart}
          tone="order"
          label={allocation.salesOrderNumber || 'Sales order'}
          to={canOpenOrder ? salesOrderPath(allocation.salesOrderId) : undefined}
          ariaLabel={`Sales order ${allocation.salesOrderNumber || ''}`.trim()}
        />
      )}
      <UnitAllocationChip
        icon={Wrench}
        tone="job"
        label={allocation.jobNumber || 'Fabrication job'}
        to={canOpenJob ? fabricationJobPath(allocation.jobId) : undefined}
        ariaLabel={`Fabrication job ${allocation.jobNumber || ''}`.trim()}
      />
    </div>
  );
}
