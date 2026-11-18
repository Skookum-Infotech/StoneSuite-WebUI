import { describe, expect, it } from 'vitest';
import type { DrawingSlabItem, DrawingSlabUnit } from '@/types/drawingSlab';
import { makeUnit } from '@/pages/inventory/unit/components/unitFixtures';
import { canAddToDrawing, isAwaitingInspection, isHandedToJob, isOnOrderDrawing, slabsOnDrawing } from './slabHolds';

const ORDER = 'so-1';
const unit = (overrides: Partial<DrawingSlabUnit>): DrawingSlabUnit => makeUnit(overrides);
const jobUsage = (salesOrderId: string) => ({
  jobId: 'job-1', jobNumber: 'FJOB-1', salesOrderId, offcutCount: 0, recoveredArea: 0, usedArea: 0,
});

describe('isOnOrderDrawing', () => {
  it.each([
    ['held for this order from its drawing', unit({ status: 'reserved', reservedSalesOrderId: ORDER }), true],
    ['taken over by this order\'s job', unit({ status: 'reserved', usage: jobUsage(ORDER) }), true],
    ['cut for this order', unit({ status: 'consumed', usage: jobUsage(ORDER) }), true],
    ['held for another order', unit({ status: 'reserved', reservedSalesOrderId: 'so-2' }), false],
    ['held by another order\'s job', unit({ status: 'reserved', usage: jobUsage('so-2') }), false],
    ['held for a customer', unit({ status: 'reserved', reservedCustomerId: 'c-1' }), false],
    ['free in stock', unit({ status: 'available' }), false],
    ['cut for another order', unit({ status: 'consumed', usage: jobUsage('so-2') }), false],
  ])('%s', (_label, u, expected) => {
    expect(isOnOrderDrawing(u, ORDER)).toBe(expected);
  });
});

describe('canAddToDrawing / isHandedToJob', () => {
  it('lets only a free slab be added', () => {
    expect(canAddToDrawing(unit({ status: 'available' }))).toBe(true);
    expect(canAddToDrawing(unit({ status: 'reserved' }))).toBe(false);
    expect(canAddToDrawing(unit({ status: 'consumed' }))).toBe(false);
  });

  it('knows a slab a job has taken, which the drawing can no longer give back', () => {
    expect(isHandedToJob(unit({ status: 'reserved', usage: jobUsage(ORDER) }))).toBe(true);
    expect(isHandedToJob(unit({ status: 'reserved', reservedSalesOrderId: ORDER }))).toBe(false);
  });
});

describe('slabsOnDrawing', () => {
  it('gathers the order\'s slabs across items, sorted by serial, leaving out the ones to add', () => {
    const items: DrawingSlabItem[] = [
      { itemId: 'i-1', itemName: 'Granite', itemSku: 'G', units: [
        unit({ id: 'a', serial: 'TM-9', status: 'reserved', reservedSalesOrderId: ORDER }),
        unit({ id: 'b', serial: 'TM-1', status: 'available' }),
      ] },
      { itemId: 'i-2', itemName: 'Marble', itemSku: 'M', units: [
        unit({ id: 'c', serial: 'MB-2', status: 'reserved', reservedSalesOrderId: ORDER }),
      ] },
    ];

    expect(slabsOnDrawing(items, ORDER).map((u) => u.serial)).toEqual(['MB-2', 'TM-9']);
  });

  it('is empty when nothing is held', () => {
    expect(slabsOnDrawing([], ORDER)).toEqual([]);
  });
});

describe('slabs awaiting inspection', () => {
  const pending = unit({ status: 'available', inspectionStatus: 'pending' });

  it('are in stock but cannot be added until accepted', () => {
    expect(isAwaitingInspection(pending)).toBe(true);
    expect(canAddToDrawing(pending)).toBe(false);
    expect(canAddToDrawing(unit({ status: 'available', inspectionStatus: 'accepted' }))).toBe(true);
    expect(canAddToDrawing(unit({ status: 'available', inspectionStatus: 'legacy' }))).toBe(true);
    expect(canAddToDrawing(unit({ status: 'available', inspectionStatus: 'rejected' }))).toBe(false);
  });
});
