import { usageOf } from '@/lib/unitConsumption';
import { UNIT_STATUS_RESERVED } from '@/types/inventory';
import type { InventoryUnit } from '@/types/inventory';

/** Whose stone a slab is: the fabrication job that has claimed it and the sales
 *  order that job is for. */
export interface UnitAllocation {
  jobId: string;
  jobNumber: string;
  /** Empty when the job's order is gone or was not sent. */
  salesOrderId: string;
  salesOrderNumber: string;
  /** True while the job is merely holding the slab; false once it has cut it. */
  held: boolean;
}

export function salesOrderPath(id: string): string {
  return `/sales/sales_order/${id}`;
}

export function fabricationJobPath(id: string): string {
  return `/sales/installation/${id}`;
}

/** The job and order a unit is allocated to, or null for a unit no job has
 *  claimed — including one cut by hand from the Inventory screen. A cut slab keeps
 *  its allocation, so it still says whose stone it was. */
export function allocationOf(unit: InventoryUnit): UnitAllocation | null {
  const use = usageOf(unit);
  if (!use.jobId) return null;
  return {
    jobId: use.jobId,
    jobNumber: use.jobNumber ?? '',
    salesOrderId: use.salesOrderId ?? '',
    salesOrderNumber: use.salesOrderNumber ?? '',
    held: unit.status === UNIT_STATUS_RESERVED,
  };
}

/** One sentence for a tooltip or screen reader: "Reserved for sales order X,
 *  fabrication job Y." Empty for an unallocated unit. */
export function allocationSentence(unit: InventoryUnit): string {
  const allocation = allocationOf(unit);
  if (!allocation) return '';
  const lead = allocation.held ? 'Reserved for' : 'Cut for';
  const order = allocation.salesOrderNumber ? `sales order ${allocation.salesOrderNumber}, ` : '';
  const job = allocation.jobNumber ? `fabrication job ${allocation.jobNumber}` : 'a fabrication job';
  return `${lead} ${order}${job}.`;
}
