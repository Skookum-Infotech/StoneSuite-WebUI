import { describe, it, expect } from 'vitest';
import { allocationOf, allocationSentence, fabricationJobPath, salesOrderPath } from './unitAllocation';
import { makeAllocatedUnit, makeCutUnit, makeUnit } from '@/pages/inventory/unit/components/unitFixtures';

describe('allocationOf', () => {
  it('is null for a slab no job has claimed', () => {
    expect(allocationOf(makeUnit())).toBeNull();
    expect(allocationOf(makeUnit({ usage: undefined }))).toBeNull();
  });

  it('is null for a slab cut by hand, which no job held', () => {
    expect(allocationOf(makeCutUnit(30, 15.2, 2))).toBeNull();
  });

  it('names the job and order a reserved slab is held for', () => {
    expect(allocationOf(makeAllocatedUnit())).toEqual({
      jobId: 'job-7', jobNumber: 'FJOB-000007', salesOrderId: 'so-3', salesOrderNumber: 'SORD-000003', held: true,
    });
  });

  it('keeps naming them once the job has cut the slab', () => {
    const cut = allocationOf(makeAllocatedUnit({ status: 'consumed' }));

    expect(cut).toMatchObject({ jobNumber: 'FJOB-000007', salesOrderNumber: 'SORD-000003', held: false });
  });

  it('still names the job when its order was not sent', () => {
    const unit = makeAllocatedUnit();
    unit.usage = { ...unit.usage!, salesOrderId: undefined, salesOrderNumber: undefined };

    expect(allocationOf(unit)).toMatchObject({ jobId: 'job-7', salesOrderId: '', salesOrderNumber: '' });
  });
});

describe('allocationSentence', () => {
  it.each([
    ['a reserved slab', makeAllocatedUnit(), 'Reserved for sales order SORD-000003, fabrication job FJOB-000007.'],
    ['a cut slab', makeAllocatedUnit({ status: 'consumed' }), 'Cut for sales order SORD-000003, fabrication job FJOB-000007.'],
    ['a slab nobody claimed', makeUnit(), ''],
  ])('%s', (_name, unit, want) => {
    expect(allocationSentence(unit)).toBe(want);
  });

  it('leaves the order out when it is unknown', () => {
    const unit = makeAllocatedUnit();
    unit.usage = { ...unit.usage!, salesOrderNumber: '' };

    expect(allocationSentence(unit)).toBe('Reserved for fabrication job FJOB-000007.');
  });
});

describe('paths', () => {
  it('point at the sales order and fabrication job pages', () => {
    expect(salesOrderPath('so-3')).toBe('/sales/sales_order/so-3');
    expect(fabricationJobPath('job-7')).toBe('/sales/installation/job-7');
  });
});
