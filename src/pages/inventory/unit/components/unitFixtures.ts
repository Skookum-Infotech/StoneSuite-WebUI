import type { InventoryUnit } from '@/types/inventory';

// A 3000 × 1400 slab of 45.2 sq ft, in stock. Tests override what they care about.
export function makeUnit(overrides: Partial<InventoryUnit> = {}): InventoryUnit {
  return {
    id: 'unit-1',
    serial: 'PO-00012-001',
    kind: 'slab',
    supplierCode: '',
    barcode: '',
    inventoryItemId: 'item-1',
    inventoryItemName: 'Absolute Black',
    warehouseId: 1,
    warehouseName: 'Main Yard',
    lengthMm: 3000,
    widthMm: 1400,
    thicknessMm: 30,
    area: 45.2,
    areaUnitId: 6,
    areaUnitCode: 'SQFT',
    form: 'full',
    status: 'available',
    isUsableRemnant: false,
    usage: { offcutCount: 0, recoveredArea: 0, usedArea: 0 },
    createdAt: '2026-09-29T08:00:00',
    updatedAt: '2026-09-29T08:00:00',
    ...overrides,
  };
}

/** A slab that has been cut: `used` went into product and kerf, `recovered`
 *  came back as `offcuts` offcuts. */
export function makeCutUnit(used: number, recovered: number, offcuts: number, overrides: Partial<InventoryUnit> = {}): InventoryUnit {
  return makeUnit({
    status: 'consumed',
    usage: {
      usedArea: used,
      recoveredArea: recovered,
      offcutCount: offcuts,
      consumedAt: '2026-09-29T10:30:00',
    },
    ...overrides,
  });
}

/** A slab a fabrication job (FJOB-000007) is holding for a sales order
 *  (SORD-000003). Pass `status: 'consumed'` for one the job has since cut. */
export function makeAllocatedUnit(overrides: Partial<InventoryUnit> = {}): InventoryUnit {
  return makeUnit({
    status: 'reserved',
    usage: {
      jobId: 'job-7',
      jobNumber: 'FJOB-000007',
      salesOrderId: 'so-3',
      salesOrderNumber: 'SORD-000003',
      reservedAt: '2026-09-29T09:00:00',
      offcutCount: 0,
      recoveredArea: 0,
      usedArea: 0,
    },
    ...overrides,
  });
}
