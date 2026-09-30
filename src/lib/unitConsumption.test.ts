import { describe, it, expect } from 'vitest';
import {
  consumptionLine,
  consumptionSentence,
  consumptionState,
  formatUnitArea,
  lifecycleSteps,
  unitSegments,
  usageHeadline,
  usageOf,
  usageTiles,
  usedPercent,
} from './unitConsumption';
import type { InventoryUnit } from '@/types/inventory';

function unit(overrides: Partial<InventoryUnit> = {}): InventoryUnit {
  return {
    id: 'u1',
    serial: 'PO-00012-001',
    kind: 'slab',
    supplierCode: '',
    barcode: '',
    inventoryItemId: 'item-1',
    warehouseId: 1,
    lengthMm: 3000,
    widthMm: 1400,
    thicknessMm: 30,
    area: 45.2,
    areaUnitId: 6,
    areaUnitCode: 'SQFT',
    form: 'full',
    status: 'available',
    isUsableRemnant: false,
    createdAt: '2026-09-29T00:00:00',
    updatedAt: '2026-09-29T00:00:00',
    ...overrides,
  };
}

const cut = (usedArea: number, recoveredArea: number, offcutCount = 1) =>
  unit({ status: 'consumed', usage: { usedArea, recoveredArea, offcutCount } });

describe('formatUnitArea', () => {
  it.each([
    [45.208, 'SQFT', '45.21 sq ft'],
    [12, 'SQM', '12.00 sq m'],
    [3.5, undefined, '3.50'],
    [3.5, '', '3.50'],
  ])('%s %s → %s', (value, code, want) => {
    expect(formatUnitArea(value, code)).toBe(want);
  });
});

describe('usageOf', () => {
  it('is all zero when the API sent none', () => {
    expect(usageOf(unit())).toEqual({ offcutCount: 0, recoveredArea: 0, usedArea: 0 });
  });
});

describe('unitSegments', () => {
  it.each([
    ['available', 'stock', 'In stock'],
    ['reserved', 'reserved', 'Reserved'],
    ['in_transit', 'transit', 'In transit'],
    ['scrapped', 'scrapped', 'Scrapped'],
  ])('a %s unit is one whole %s segment', (status, tone, label) => {
    expect(unitSegments(unit({ status }))).toEqual([{ tone, label, area: 45.2, pct: 100 }]);
  });

  it('splits a cut unit into used and recovered', () => {
    const segments = unitSegments(cut(30, 15.2, 2));
    expect(segments.map((s) => [s.tone, s.area])).toEqual([['used', 30], ['recovered', 15.2]]);
    expect(segments[0].pct + segments[1].pct).toBeCloseTo(100, 6);
  });

  it('draws only the used part when nothing came back', () => {
    expect(unitSegments(cut(45.2, 0, 0)).map((s) => s.tone)).toEqual(['used']);
    expect(unitSegments(cut(45.2, 0, 0))[0].pct).toBeCloseTo(100, 6);
  });

  it('reads an unaccounted consumed unit as fully used, not an empty bar', () => {
    const segments = unitSegments(unit({ status: 'consumed' }));
    expect(segments).toEqual([{ tone: 'used', label: 'Used', area: 45.2, pct: 100 }]);
  });
});

describe('usedPercent', () => {
  it.each([
    [cut(30, 15.2, 2), 66], // 30 / 45.2
    [cut(45.2, 0, 0), 100],
    [unit({ status: 'consumed' }), 100],
    [unit({ status: 'available' }), 0],
    [unit({ status: 'scrapped' }), 0],
  ])('%#', (u, want) => {
    expect(usedPercent(u)).toBe(want);
  });
});

describe('consumptionLine', () => {
  it.each([
    ['an untouched slab', unit(), 'Untouched'],
    ['an offcut nobody has touched', unit({ kind: 'remnant', parentSerial: 'PO-00012-001' }), 'Offcut of PO-00012-001'],
    ['a slab held for a job', unit({ status: 'reserved', usage: { jobNumber: 'FJOB-000012', offcutCount: 0, recoveredArea: 0, usedArea: 0 } }), 'Held for FJOB-000012'],
    ['a reserved slab whose job is unknown', unit({ status: 'reserved' }), 'Held for a job'],
    ['a cut slab with offcuts', cut(30, 15.2, 2), '66% used · 15.20 sq ft back'],
    ['a slab cut with nothing kept', cut(45.2, 0, 0), 'Fully used'],
    ['a scrapped slab', unit({ status: 'scrapped' }), 'Scrapped'],
    ['a slab in transit', unit({ status: 'in_transit' }), 'In transit'],
  ])('%s', (_name, u, want) => {
    expect(consumptionLine(u)).toBe(want);
  });
});

describe('consumptionSentence', () => {
  it('says what a cut did to the area', () => {
    expect(consumptionSentence(cut(30, 15.2, 2))).toBe(
      'Cut: 30.00 sq ft used in product and saw kerf; 15.20 sq ft came back as 2 offcuts.',
    );
  });

  it('uses the singular for one offcut', () => {
    expect(consumptionSentence(cut(30, 15.2, 1))).toContain('as 1 offcut.');
  });

  it('says nothing came back when nothing did', () => {
    expect(consumptionSentence(cut(45.2, 0, 0))).toBe('Cut: all 45.20 sq ft used in product and saw kerf; nothing came back.');
  });

  it('names the job holding a reserved slab', () => {
    const u = unit({ status: 'reserved', usage: { jobNumber: 'FJOB-000012', offcutCount: 0, recoveredArea: 0, usedArea: 0 } });
    expect(consumptionSentence(u)).toBe('Whole slab, 45.20 sq ft, held for job FJOB-000012.');
  });
});

describe('consumptionState', () => {
  it.each([
    ['available', 'Untouched'],
    ['reserved', 'Held for a job'],
    ['in_transit', 'In transit'],
    ['consumed', 'Cut'],
    ['scrapped', 'Scrapped'],
    ['mystery', 'mystery'],
  ])('%s → %s', (status, want) => {
    expect(consumptionState({ status })).toBe(want);
  });
});

describe('usageHeadline', () => {
  it.each([
    ['an untouched slab', unit(), 'Untouched'],
    ['a slab held for a job', unit({ status: 'reserved' }), 'Held for a job'],
    ['a slab in transit', unit({ status: 'in_transit' }), 'In transit'],
    ['a scrapped slab', unit({ status: 'scrapped' }), 'Scrapped'],
    ['a cut slab that gave offcuts back', cut(30, 15.2, 2), '66% used'],
    ['a slab cut with nothing kept', cut(45.2, 0, 0), 'Fully used'],
  ])('%s', (_name, u, want) => {
    expect(usageHeadline(u)).toBe(want);
  });
});

describe('usageTiles', () => {
  it('breaks a cut slab into its size, what was used and what came back', () => {
    expect(usageTiles(cut(30, 15.2, 2))).toEqual([
      { label: 'Size before cutting', value: '45.20 sq ft' },
      { label: 'Used', value: '30.00 sq ft', note: 'Finished product and saw kerf', tone: 'used' },
      { label: 'Back as offcuts', value: '15.20 sq ft', note: '2 offcuts', tone: 'recovered' },
    ]);
  });

  it('says none came back when the cut kept nothing', () => {
    const tiles = usageTiles(cut(45.2, 0, 0));
    expect(tiles[1].value).toBe('45.20 sq ft');
    expect(tiles[2]).toEqual({ label: 'Back as offcuts', value: 'None', note: 'Nothing was kept from the cut' });
  });

  it('uses the whole slab as "used" when the API sent no usage', () => {
    expect(usageTiles(unit({ status: 'consumed' }))[1].value).toBe('45.20 sq ft');
  });

  it('is a single size for a piece that has not been cut', () => {
    expect(usageTiles(unit())).toEqual([{ label: 'Slab size', value: '45.20 sq ft', note: 'Still whole', tone: 'stock' }]);
    expect(usageTiles(unit({ kind: 'remnant' }))[0].label).toBe('Offcut size');
    const reserved = usageTiles(unit({ status: 'reserved' }))[0];
    expect(reserved.tone).toBe('reserved');
    expect(reserved.note).toBeUndefined();
  });
});

describe('lifecycleSteps', () => {
  const keys = (u: InventoryUnit) => lifecycleSteps(u).map((s) => s.key);

  it('is receipt, then in stock, for a slab nobody has touched', () => {
    const steps = lifecycleSteps(unit({
      receiptId: 'ir-1', receiptNumber: 'IR-000123', warehouseName: 'Main Yard', binPath: 'Yard / A1',
    }));

    expect(steps.map((s) => s.key)).toEqual(['arrived', 'stock']);
    expect(steps[0]).toMatchObject({ title: 'Received on', link: { label: 'IR-000123', to: '/purchases/item_receipt/ir-1' } });
    expect(steps[1]).toMatchObject({ title: 'In stock', detail: 'Main Yard · Yard / A1', current: true });
    expect(steps[0].current).toBe(false);
  });

  it('runs receipt, job, cut for a slab a job cut', () => {
    const steps = lifecycleSteps(cut(30, 15.2, 2));
    expect(steps.map((s) => s.key)).toEqual(['arrived', 'cut']);

    const viaJob = lifecycleSteps(unit({
      status: 'consumed',
      usage: { jobId: 'job-7', jobNumber: 'FJOB-000007', reservedAt: '2026-09-28T09:00:00', consumedAt: '2026-09-29T10:00:00', usedArea: 30, recoveredArea: 15.2, offcutCount: 2 },
    }));
    expect(viaJob.map((s) => s.key)).toEqual(['arrived', 'reserved', 'cut']);
    expect(viaJob[1]).toMatchObject({ title: 'Held for job', link: { label: 'FJOB-000007', to: '/sales/installation/job-7' }, at: '2026-09-28T09:00:00' });
    expect(viaJob[2]).toMatchObject({
      title: 'Cut', detail: '30.00 sq ft used · 15.20 sq ft came back as 2 offcuts', at: '2026-09-29T10:00:00', current: true,
    });
  });

  it('says all of it was used when a cut kept nothing', () => {
    expect(lifecycleSteps(cut(45.2, 0, 0)).at(-1)?.detail).toBe('All 45.20 sq ft used');
  });

  it('starts an offcut at the slab it was cut from', () => {
    const steps = lifecycleSteps(unit({ kind: 'remnant', form: 'cut', parentUnitId: 'p-1', parentSerial: 'PO-00012-001' }));

    expect(steps[0]).toMatchObject({ title: 'Cut from', link: { label: 'PO-00012-001', to: '/inventory/unit/p-1' } });
  });

  it('starts a unit with no receipt or parent as simply added', () => {
    const arrival = lifecycleSteps(unit())[0];
    expect(arrival.title).toBe('Added to inventory');
    expect(arrival.link).toBeUndefined();
  });

  it('ends a reserved slab at the job holding it, with no separate stock step', () => {
    const held = unit({ status: 'reserved', usage: { jobId: 'job-7', jobNumber: 'FJOB-000007', offcutCount: 0, recoveredArea: 0, usedArea: 0 } });

    expect(keys(held)).toEqual(['arrived', 'reserved']);
    expect(lifecycleSteps(held).at(-1)?.current).toBe(true);
  });

  it('names a reserved slab whose job is unknown without a link', () => {
    const steps = lifecycleSteps(unit({ status: 'reserved' }));

    expect(steps[1].title).toBe('Held for a job');
    expect(steps[1].link).toBeUndefined();
  });

  it.each([
    ['scrapped', ['arrived', 'scrapped']],
    ['in_transit', ['arrived', 'transit']],
  ])('%s ends at its own step', (status, want) => {
    expect(keys(unit({ status }))).toEqual(want);
  });

  it('marks exactly one step as current, the last', () => {
    for (const u of [unit(), cut(30, 15.2, 2), unit({ status: 'reserved' }), unit({ status: 'scrapped' })]) {
      const steps = lifecycleSteps(u);
      expect(steps.filter((s) => s.current)).toHaveLength(1);
      expect(steps.at(-1)?.current).toBe(true);
    }
  });
});
