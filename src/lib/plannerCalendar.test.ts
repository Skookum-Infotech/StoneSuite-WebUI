import { describe, it, expect } from 'vitest';
import {
  PLANNER_ACTIVITIES,
  addDays,
  bucketByColumn,
  columnKeyFor,
  columnName,
  columnsFor,
  parseAnchor,
  parseView,
  rangeFor,
  rangeLabel,
  shiftAnchor,
  showsToday,
  startOfWeek,
} from './plannerCalendar';

// 2026-10-12 is a Monday, so Oct 12–18 is a Monday-to-Sunday week.
const MONDAY = '2026-10-12';
const THURSDAY = '2026-10-15';
const SUNDAY = '2026-10-18';

describe('PLANNER_ACTIVITIES', () => {
  it('lists the eight tabs in the order the planners asked for', () => {
    expect(PLANNER_ACTIVITIES.map((a) => a.label)).toEqual([
      'Template', 'Engineering', 'Bin Transfer', 'Saw', 'Edges', 'Quality Control', 'Installation', 'Invoicing',
    ]);
  });

  it('keys are unique and URL-safe', () => {
    const keys = PLANNER_ACTIVITIES.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('asks the API for the group the order schedule really uses', () => {
    const bin = PLANNER_ACTIVITIES.find((a) => a.key === 'bin-transfer');
    expect(bin).toMatchObject({ source: 'schedule', group: 'WIP Bin Transfer' });
  });

  it('reads Invoicing from invoices, not from the schedule', () => {
    expect(PLANNER_ACTIVITIES.find((a) => a.key === 'invoicing')?.source).toBe('invoice');
  });
});

describe('parseView / parseAnchor', () => {
  it('falls back to Week for anything unknown', () => {
    expect(parseView('month')).toBe('month');
    expect(parseView('day')).toBe('day');
    expect(parseView('year')).toBe('week');
    expect(parseView(null)).toBe('week');
    expect(parseView(undefined)).toBe('week');
  });

  it('keeps a real date and replaces anything else with the fallback', () => {
    expect(parseAnchor('2026-10-15', MONDAY)).toBe('2026-10-15');
    expect(parseAnchor('2026-02-30', MONDAY)).toBe(MONDAY);
    expect(parseAnchor('tomorrow', MONDAY)).toBe(MONDAY);
    expect(parseAnchor(null, MONDAY)).toBe(MONDAY);
  });
});

describe('date arithmetic', () => {
  it('steps across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('steps across a daylight-saving change by whole days', () => {
    // US clocks go forward on 2026-03-08 and back on 2026-11-01.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });

  it('finds the Monday a week starts on — Sunday belongs to the week before it', () => {
    expect(startOfWeek(MONDAY)).toBe(MONDAY);
    expect(startOfWeek(THURSDAY)).toBe(MONDAY);
    expect(startOfWeek(SUNDAY)).toBe(MONDAY);
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
});

describe('rangeFor', () => {
  it.each([
    ['day', THURSDAY, { from: THURSDAY, to: THURSDAY }],
    ['week', THURSDAY, { from: MONDAY, to: SUNDAY }],
    ['month', THURSDAY, { from: '2026-10-01', to: '2026-10-31' }],
    ['month', '2028-02-10', { from: '2028-02-01', to: '2028-02-29' }], // leap year
    ['week', '2026-12-30', { from: '2026-12-28', to: '2027-01-03' }], // across New Year
  ] as const)('%s around %s', (view, anchor, want) => {
    expect(rangeFor(view, anchor)).toEqual(want);
  });
});

describe('shiftAnchor', () => {
  it.each([
    ['day', THURSDAY, 1, '2026-10-16'],
    ['day', THURSDAY, -1, '2026-10-14'],
    ['week', THURSDAY, 1, '2026-10-22'],
    ['week', THURSDAY, -1, '2026-10-08'],
    ['month', THURSDAY, 1, '2026-11-01'],
    ['month', THURSDAY, -1, '2026-09-01'],
    // The 31st must not overflow into the month after next.
    ['month', '2026-10-31', 1, '2026-11-01'],
    ['month', '2026-03-31', -1, '2026-02-01'],
    ['month', '2026-12-15', 1, '2027-01-01'],
  ] as const)('%s from %s by %i', (view, anchor, direction, want) => {
    expect(shiftAnchor(view, anchor, direction)).toBe(want);
  });
});

describe('showsToday', () => {
  it('is true only while the window contains today', () => {
    expect(showsToday('week', THURSDAY, '2026-10-17')).toBe(true);
    expect(showsToday('week', THURSDAY, '2026-10-19')).toBe(false);
    expect(showsToday('month', THURSDAY, '2026-10-31')).toBe(true);
    expect(showsToday('day', THURSDAY, '2026-10-16')).toBe(false);
  });
});

describe('rangeLabel', () => {
  it.each([
    ['day', THURSDAY, 'Thu, Oct 15, 2026'],
    ['week', THURSDAY, 'Oct 12 – 18, 2026'],
    ['week', '2026-10-28', 'Oct 26 – Nov 1, 2026'],
    ['week', '2026-12-30', 'Dec 28, 2026 – Jan 3, 2027'],
    ['month', THURSDAY, 'October 2026'],
  ] as const)('%s around %s reads "%s"', (view, anchor, want) => {
    expect(rangeLabel(view, anchor)).toBe(want);
  });
});

describe('columnsFor', () => {
  it('lays a week out as seven days, Monday first, flagging today and the weekend', () => {
    const cols = columnsFor('week', THURSDAY, '2026-10-15');
    expect(cols).toHaveLength(7);
    expect(cols.map((c) => c.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(cols[0]).toMatchObject({ key: MONDAY, subLabel: 'Oct 12', date: MONDAY });
    expect(cols.filter((c) => c.isToday).map((c) => c.key)).toEqual([THURSDAY]);
    expect(cols.filter((c) => c.isWeekend).map((c) => c.label)).toEqual(['Sat', 'Sun']);
  });

  it('lays a month out as one column per day', () => {
    expect(columnsFor('month', THURSDAY, '2026-10-15')).toHaveLength(31);
    expect(columnsFor('month', '2026-02-10', '2026-10-15')).toHaveLength(28);
    expect(columnsFor('month', '2028-02-10', '2026-10-15')).toHaveLength(29);
  });

  it('lays a day out as the working hours', () => {
    const cols = columnsFor('day', THURSDAY, '2026-10-15');
    expect(cols).toHaveLength(14);
    expect(cols[0]).toMatchObject({ key: '2026-10-15T06', label: '6 AM' });
    expect(cols[6]).toMatchObject({ key: '2026-10-15T12', label: '12 PM' });
    expect(cols[13]).toMatchObject({ key: '2026-10-15T19', label: '7 PM' });
  });

  it('collapses the day to one "All day" column for events with no time', () => {
    const cols = columnsFor('day', THURSDAY, '2026-10-15', false);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({ key: THURSDAY, label: 'All day' });
  });
});

describe('columnName', () => {
  it('names a day by weekday and date, and an hour or "All day" by its label alone', () => {
    expect(columnName(columnsFor('week', THURSDAY, THURSDAY)[3])).toBe('Thu, Oct 15');
    expect(columnName(columnsFor('day', THURSDAY, THURSDAY)[3])).toBe('9 AM');
    expect(columnName(columnsFor('day', THURSDAY, THURSDAY, false)[0])).toBe('All day');
  });
});

describe('columnKeyFor', () => {
  it.each([
    ['week', '2026-10-14T09:00:00', undefined, '2026-10-14'],
    ['week', '2026-10-14T09:00', undefined, '2026-10-14'],
    ['month', '2026-10-14T17:00:00', undefined, '2026-10-14'],
    ['day', '2026-10-15T09:00:00', undefined, '2026-10-15T09'],
    ['day', '2026-10-15T13:45:00', undefined, '2026-10-15T13'],
    // Outside working hours: the nearest edge column.
    ['day', '2026-10-15T05:30:00', undefined, '2026-10-15T06'],
    ['day', '2026-10-15T21:00:00', undefined, '2026-10-15T19'],
    // A source with no time of day always lands in the day's one column.
    ['day', '2026-10-15T00:00', false, '2026-10-15'],
  ] as const)('%s view, %s', (view, at, timed, want) => {
    expect(columnKeyFor(view, at, timed)).toBe(want);
  });

  it('is null for a value that is not a wall-clock time', () => {
    expect(columnKeyFor('week', 'soon')).toBeNull();
    expect(columnKeyFor('week', '')).toBeNull();
  });
});

describe('bucketByColumn', () => {
  const columns = columnsFor('week', THURSDAY, '2026-10-15');
  const ev = (id: string, at: string, sortKey = id) => ({ id, at, sortKey });

  it('gives every column a bucket, empty or not', () => {
    const buckets = bucketByColumn([ev('a', '2026-10-14T09:00:00')], 'week', columns);
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
      'week',
      columns,
    );
    expect(buckets.get('2026-10-14')?.map((e) => e.id)).toEqual(['a-nine', 'b-nine', 'late']);
  });

  it('drops an event outside the window and one it cannot place', () => {
    const buckets = bucketByColumn(
      [ev('before', '2026-10-11T09:00:00'), ev('after', '2026-10-19T09:00:00'), ev('junk', 'whenever'), ev('in', MONDAY + 'T09:00')],
      'week',
      columns,
    );
    const placed = [...buckets.values()].flat().map((e) => e.id);
    expect(placed).toEqual(['in']);
  });

  it('places events into hour columns in the Day view', () => {
    const dayCols = columnsFor('day', THURSDAY, '2026-10-15');
    const buckets = bucketByColumn(
      [ev('nine', '2026-10-15T09:00:00'), ev('nine-thirty', '2026-10-15T09:30:00'), ev('five', '2026-10-15T17:00:00')],
      'day',
      dayCols,
    );
    expect(buckets.get('2026-10-15T09')?.map((e) => e.id)).toEqual(['nine', 'nine-thirty']);
    expect(buckets.get('2026-10-15T17')?.map((e) => e.id)).toEqual(['five']);
  });
});
