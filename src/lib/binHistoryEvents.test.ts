import { describe, it, expect } from 'vitest';
import { binEventLabel, binEventTone, binEventCounterpart } from './binHistoryEvents';
import type { BinHistoryEntry } from '@/types/inventory';

const entry = (over: Partial<BinHistoryEntry>): BinHistoryEntry => ({
  action: 'bin_move', direction: 'in', unitId: 'u-1', unitSerial: 'SLB-1',
  at: '2026-10-14T10:42:00', byName: 'Maria', ...over,
});

describe('binEventLabel', () => {
  it.each([
    [{ action: 'bin_move', direction: 'in' }, 'Moved in'],
    [{ action: 'bin_move', direction: 'out' }, 'Moved out'],
    [{ action: 'create', direction: 'in' }, 'Received'],
    [{ action: 'cut', direction: 'out' }, 'Cut'],
    [{ action: 'scrap', direction: 'out' }, 'Scrapped'],
    [{ action: 'remnant_created', direction: 'in' }, 'Offcut added'],
    [{ action: 'warehouse_move', direction: 'out' }, 'Sent to another location'],
    [{ action: 'warehouse_move', direction: 'in' }, 'Arrived from another location'],
  ] as [Partial<BinHistoryEntry>, string][])('%j reads "%s"', (over, label) => {
    expect(binEventLabel(entry(over))).toBe(label);
  });

  it('falls back to the action, humanised', () => {
    expect(binEventLabel(entry({ action: 'status_change', direction: 'other' }))).toBe('Status change');
  });
});

describe('binEventTone', () => {
  it('colours arrivals, departures and everything else apart', () => {
    expect(binEventTone(entry({ direction: 'in' }))).toBe('in');
    expect(binEventTone(entry({ action: 'bin_move', direction: 'out' }))).toBe('out');
    expect(binEventTone(entry({ action: 'scrap', direction: 'out' }))).toBe('loss');
    expect(binEventTone(entry({ action: 'cut', direction: 'out' }))).toBe('neutral');
  });
});

describe('binEventCounterpart', () => {
  it('names where a slab came from or went to', () => {
    expect(binEventCounterpart(entry({ direction: 'in', fromBinPath: 'YARD/A1' }))).toBe('from YARD/A1');
    expect(binEventCounterpart(entry({ direction: 'out', toBinPath: 'RACK/B2' }))).toBe('to RACK/B2');
  });

  it('says so when there was no bin on the other side', () => {
    expect(binEventCounterpart(entry({ direction: 'in' }))).toBe('from no bin');
    expect(binEventCounterpart(entry({ direction: 'out' }))).toBe('to no bin');
  });

  it('has nothing to say for events that are not a move', () => {
    expect(binEventCounterpart(entry({ action: 'cut', direction: 'out' }))).toBe('');
    expect(binEventCounterpart(entry({ action: 'scrap', direction: 'out' }))).toBe('');
  });
});
