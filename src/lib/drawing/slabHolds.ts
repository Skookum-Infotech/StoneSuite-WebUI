// Which of an order's slab options are already on its drawing, and which can still
// be added. The server decides what is offered; this only sorts it for the screen.

import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_CONSUMED, UNIT_STATUS_RESERVED } from '@/types/inventory';

/** Whether the unit is on this order's drawing: held for the order from the
 *  drawing, or taken over by one of its fabrication jobs (and perhaps cut since).
 *  Once a job has a slab the order's own hold is cleared, so the job is what names it. */
export function isOnOrderDrawing(unit: DrawingSlabUnit, salesOrderId: string): boolean {
  if (unit.status === UNIT_STATUS_RESERVED) {
    return unit.reservedSalesOrderId === salesOrderId || unit.usage?.salesOrderId === salesOrderId;
  }
  return unit.status === UNIT_STATUS_CONSUMED && unit.usage?.salesOrderId === salesOrderId;
}

/** A slab that is in stock but has not been accepted yet. It is listed so stock in the
 *  yard does not seem to be missing, but it cannot be reserved until it passes inspection. */
export function isAwaitingInspection(unit: DrawingSlabUnit): boolean {
  return unit.inspectionStatus === 'pending';
}

/** Whether the unit is free to add to the drawing: in stock and inspected. */
export function canAddToDrawing(unit: DrawingSlabUnit): boolean {
  return unit.status === UNIT_STATUS_AVAILABLE && !isAwaitingInspection(unit) && unit.inspectionStatus !== 'rejected';
}

/** A slab a fabrication job holds or has cut can stay on the drawing but no longer
 *  be given back from it — the job owns it. */
export function isHandedToJob(unit: DrawingSlabUnit): boolean {
  return Boolean(unit.usage?.jobId);
}

/** The slabs on the order's drawing, across every item, in serial order. */
export function slabsOnDrawing(items: DrawingSlabItem[], salesOrderId: string): DrawingSlabUnit[] {
  return items
    .flatMap((item) => item.units)
    .filter((unit) => isOnOrderDrawing(unit, salesOrderId))
    .sort((a, b) => a.serial.localeCompare(b.serial));
}
