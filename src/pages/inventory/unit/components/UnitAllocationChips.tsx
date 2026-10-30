import { ShoppingCart, UserRound, Wrench } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { allocationOf, allocationSentence, customerPath, customerReservationOf, fabricationJobPath, salesOrderPath } from '@/lib/unitAllocation';
import type { InventoryUnit } from '@/types/inventory';
import { UnitAllocationChip } from './UnitAllocationChip';

// The sales order and fabrication job a slab is allocated to, as two links — or
// the customer it is reserved for, when it was reserved from Inventory. Shown in
// the Inventory list's Allocated To column and in the slab page's banner.
// Renders nothing for a slab nobody has claimed.
export function UnitAllocationChips({ unit }: { unit: InventoryUnit }) {
  const { hasPermission, isLoading } = useUserPermissions();
  const allocation = allocationOf(unit);
  const customer = customerReservationOf(unit);
  if (!allocation) {
    if (!customer) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5" title={allocationSentence(unit)}>
        <UnitAllocationChip
          icon={UserRound}
          tone="customer"
          label={customer.customerName || 'Customer'}
          to={isLoading || hasPermission('customer', 'read') ? customerPath(customer.customerId) : undefined}
          ariaLabel={`Customer ${customer.customerName}`.trim()}
        />
      </div>
    );
  }

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
