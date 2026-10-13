import { describe, it, expect } from 'vitest';
import { columnsFor } from './plannerCalendar';
import {
  PLANNER_HOUR_ROWS,
  bucketByColumn,
  bucketByHour,
  columnKeyFor,
  hourRowFor,
} from './plannerPlacement';

const MONDAY = '2026-10-12';
const THURSDAY = '2026-10-15';

describe('columnKeyFor', () => {
  it.each([
    ['2026-10-14T09:00:00', '2026-10-14'],
    ['2026-10-14T09:00', '2026-10-14'],
    ['2026-10-14T17:45:00', '2026-10-14'],
    // An invoice's due date carries no time of day.
    ['2026-10-14T00:00', '2026-10-14'],
  ])('%s is in the %s column', (at, want) => {
    expect(columnKeyFor(at)).toBe(want);
  });

  it('is null for a value that is not a wall-clock time', () => {
    expect(columnKeyFor('soon')).toBeNull();
    expect(columnKeyFor('')).toBeNull();
  });
});

describe('bucketByColumn', () => {
  const columns = columnsFor('week', THURSDAY, THURSDAY);
  const ev = (id: string, at: string, sortKey = id) => ({ id, at, sortKey });

  it('gives every column a bucket, empty or not', () => {
    const buckets = bucketByColumn([ev('a', '2026-10-14T09:00:00')], columns);
    expect([...buckets.keys()]).toEqual(columns.map((c) => c.key));
    expect(buckets.get('2026-10-14')?.map((e) => e.id)).toEqual(['a']);
    expect(buckets.get(MONDAY)).toEqual([]);
  });

  it('orders a column soonest first, then by the tiebreak', () => {
    const buckets = bucketByColumn(
      [
        ev('late', '2026-10-14T15:00:00'),
        ev('b-nine', '2026-10-14T09:00:00', 'SO-2'),
        ev('a-nine', '2026-10-14T09:00:00', 'SO-1'),
      ],
      columns,
    );
    expect(buckets.get('2026-10-14')?.map((e) => e.id)).toEqual(['a-nine', 'b-nine', 'late']);
  });

  it('drops an event outside the window and one it cannot place', () => {
    const buckets = bucketByColumn(
      [ev('before', '2026-10-10T09:00:00'), ev('after', '2026-10-18T09:00:00'), ev('junk', 'whenever'), ev('in', MONDAY + 'T09:00')],
      columns,
    );
    const placed = [...buckets.values()].flat().map((e) => e.id);
    expect(placed).toEqual(['in']);
  });

  it('puts a whole day in the Day view’s one column, whatever the hour', () => {
    const dayCols = columnsFor('day', THURSDAY, THURSDAY);
    const buckets = bucketByColumn(
      [ev('nine', '2026-10-15T09:00:00'), ev('five', '2026-10-15T17:00:00'), ev('other', '2026-10-16T09:00:00')],
      dayCols,
    );
    expect(buckets.get(THURSDAY)?.map((e) => e.id)).toEqual(['nine', 'five']);
  });

  it('places the neighbouring days a month grid shows', () => {
    const grid = columnsFor('month', THURSDAY, THURSDAY);
    const buckets = bucketByColumn([ev('sep', '2026-09-28T09:00:00'), ev('oct', '2026-10-02T09:00:00')], grid);
    expect(buckets.get('2026-09-28')?.map((e) => e.id)).toEqual(['sep']);
    expect(buckets.get('2026-10-02')?.map((e) => e.id)).toEqual(['oct']);
  });
});

describe('PLANNER_HOUR_ROWS', () => {
  it('runs the shop’s working hours, 6 AM to 7 PM', () => {
    expect(PLANNER_HOUR_ROWS).toHaveLength(14);
    expect(PLANNER_HOUR_ROWS[0]).toEqual({ hour: 6, label: '6 AM' });
    expect(PLANNER_HOUR_ROWS[6]).toEqual({ hour: 12, label: '12 PM' });
    expect(PLANNER_HOUR_ROWS[13]).toEqual({ hour: 19, label: '7 PM' });
  });
});

describe('hourRowFor', () => {
  it.each([
    ['2026-10-15T09:00:00', 9],
    ['2026-10-15T13:45:00', 13],
    // Outside working hours: the nearest edge row.
    ['2026-10-15T05:30:00', 6],
    ['2026-10-15T00:00', 6],
    ['2026-10-15T21:00:00', 19],
  ])('%s sits in the %i o’clock row', (at, want) => {
    expect(hourRowFor(at)).toBe(want);
  });

  it('is null for a value that is not a wall-clock time', () => {
    expect(hourRowFor('soon')).toBeNull();
  });
});

describe('bucketByHour', () => {
  const ev = (id: string, at: string) => ({ id, at, sortKey: id });

  it('gives every hour row a bucket and keeps each row’s order', () => {
    const buckets = bucketByHour([
      ev('nine', '2026-10-15T09:00:00'),
      ev('nine-thirty', '2026-10-15T09:30:00'),
      ev('five', '2026-10-15T17:00:00'),
    ]);
    expect([...buckets.keys()]).toEqual(PLANNER_HOUR_ROWS.map((r) => r.hour));
    expect(buckets.get(9)?.map((e) => e.id)).toEqual(['nine', 'nine-thirty']);
    expect(buckets.get(17)?.map((e) => e.id)).toEqual(['five']);
    expect(buckets.get(10)).toEqual([]);
  });

  it('folds an early or late event into the edge row, and drops one it cannot place', () => {
    const buckets = bucketByHour([ev('early', '2026-10-15T05:00:00'), ev('late', '2026-10-15T22:00:00'), ev('junk', 'x')]);
    expect(buckets.get(6)?.map((e) => e.id)).toEqual(['early']);
    expect(buckets.get(19)?.map((e) => e.id)).toEqual(['late']);
    expect([...buckets.values()].flat()).toHaveLength(2);
  });
});
