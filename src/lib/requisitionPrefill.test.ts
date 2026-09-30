import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  REQUISITION_PREFILL_KEY,
  clearRequisitionPrefill,
  openRequisitionForShortages,
  peekRequisitionPrefill,
  prefillLinesFrom,
  stashRequisitionPrefill,
} from './requisitionPrefill';
import type { StockShortage } from '@/types/salesOrder';

const SLAB: StockShortage = {
  itemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT', requested: 60, available: 45.208, short: 14.7920001,
};
const SINK: StockShortage = {
  itemId: 'item-2', sku: 'SINK-9', name: 'Undermount Sink', unitCode: 'EA', requested: 4, available: 1, short: 3,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('prefillLinesFrom', () => {
  it('asks for exactly what each item is short, trimmed of float noise', () => {
    expect(prefillLinesFrom([SLAB, SINK])).toEqual([
      { inventoryItemUuid: 'item-1', itemName: 'Absolute Black', itemSku: 'GRAN-001', units: 'SQFT', quantity: '14.792' },
      { inventoryItemUuid: 'item-2', itemName: 'Undermount Sink', itemSku: 'SINK-9', units: 'EA', quantity: '3' },
    ]);
  });
});

describe('stash and peek', () => {
  it('round-trips the shortfall into requisition line items', () => {
    expect(stashRequisitionPrefill([SLAB, SINK])).toBe(true);

    const lines = peekRequisitionPrefill();

    expect(lines).toHaveLength(2);
    expect(lines?.[0]).toMatchObject({
      lineNo: 1, itemName: 'Absolute Black', quantity: '14.792', inventoryItemUuid: 'item-1', itemSku: 'GRAN-001', units: 'SQFT',
      estimatedUnitPrice: '', amount: '', itemDescription: '',
    });
    expect(lines?.[1].lineNo).toBe(2);
    expect(new Set(lines?.map((l) => l.id)).size).toBe(2);
  });

  it('can be read more than once — a re-render must not lose it', () => {
    stashRequisitionPrefill([SLAB]);

    expect(peekRequisitionPrefill()).not.toBeNull();
    expect(peekRequisitionPrefill()).not.toBeNull();
  });

  it('is gone once cleared', () => {
    stashRequisitionPrefill([SLAB]);
    clearRequisitionPrefill();

    expect(peekRequisitionPrefill()).toBeNull();
  });

  it.each([
    ['nothing stashed', null],
    ['not JSON', '{oops'],
    ['not a list', '{"a":1}'],
    ['an empty list', '[]'],
    ['a line missing a field', JSON.stringify([{ inventoryItemUuid: 'x', itemName: 'y' }])],
    ['a line with a non-string field', JSON.stringify([{ inventoryItemUuid: 'x', itemName: 'y', itemSku: 's', units: 'EA', quantity: 3 }])],
  ])('ignores %s', (_name, raw) => {
    if (raw !== null) window.localStorage.setItem(REQUISITION_PREFILL_KEY, raw);

    expect(peekRequisitionPrefill()).toBeNull();
  });

  it('copes with storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(stashRequisitionPrefill([SLAB])).toBe(false);
    expect(peekRequisitionPrefill()).toBeNull();
    expect(() => clearRequisitionPrefill()).not.toThrow();
  });
});

describe('openRequisitionForShortages', () => {
  it('stashes the shortfall and opens a new requisition in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openRequisitionForShortages([SLAB]);

    expect(open).toHaveBeenCalledWith('/purchases/requisition/new', '_blank', 'noopener');
    expect(peekRequisitionPrefill()?.[0].itemName).toBe('Absolute Black');
  });
});
