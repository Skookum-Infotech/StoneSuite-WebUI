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

/** The customer a slab is held for when it was reserved from Inventory. */
export interface CustomerReservation {
  customerId: string;
  customerName: string;
}

export function customerPath(id: string): string {
  return `/crm/customer/${id}`;
}

/** The customer a unit is reserved for, or null when nobody reserved it from
 *  Inventory (including a slab a fabrication job is holding). Only a unit that is
 *  still reserved has one. */
export function customerReservationOf(unit: InventoryUnit): CustomerReservation | null {
  if (unit.status !== UNIT_STATUS_RESERVED || !unit.reservedCustomerId) return null;
  return { customerId: unit.reservedCustomerId, customerName: unit.reservedCustomerName ?? '' };
}

/** Whether a unit is spoken for by a job or a customer. */
export function isAllocated(unit: InventoryUnit): boolean {
  return allocationOf(unit) !== null || customerReservationOf(unit) !== null;
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
  if (!allocation) {
    const customer = customerReservationOf(unit);
    return customer ? `Reserved for customer ${customer.customerName || 'on file'}.` : '';
  }
  const lead = allocation.held ? 'Reserved for' : 'Cut for';
  const order = allocation.salesOrderNumber ? `sales order ${allocation.salesOrderNumber}, ` : '';
  const job = allocation.jobNumber ? `fabrication job ${allocation.jobNumber}` : 'a fabrication job';
  return `${lead} ${order}${job}.`;
}
