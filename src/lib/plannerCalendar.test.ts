import { describe, it, expect } from 'vitest';
import {
  PLANNER_ACTIVITIES,
  addDays,
  columnName,
  columnsFor,
  parseAnchor,
  parseView,
  rangeFor,
  rangeLabel,
  shiftAnchor,
  showsToday,
  startOfWeek,
  weeksOf,
} from './plannerCalendar';

// 2026-10-11 is a Sunday, so Oct 11–17 is a Sunday-to-Saturday week.
const WEEK_START = '2026-10-11';
const MONDAY = '2026-10-12';
const THURSDAY = '2026-10-15';
const WEEK_END = '2026-10-17';

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

  it('finds the Sunday a week starts on — Saturday belongs to the week it ends', () => {
    expect(startOfWeek(WEEK_START)).toBe(WEEK_START);
    expect(startOfWeek(THURSDAY)).toBe(WEEK_START);
    expect(startOfWeek(WEEK_END)).toBe(WEEK_START);
    expect(startOfWeek('2026-10-18')).toBe('2026-10-18');
  });
});

describe('rangeFor', () => {
  it.each([
    ['day', THURSDAY, { from: THURSDAY, to: THURSDAY }],
    ['week', THURSDAY, { from: WEEK_START, to: WEEK_END }],
    ['week', '2026-12-30', { from: '2026-12-27', to: '2027-01-02' }], // across New Year
    // A month is the whole grid: whole weeks, with the neighbouring days that fill them.
    ['month', THURSDAY, { from: '2026-09-27', to: '2026-10-31' }],
    ['month', '2028-02-10', { from: '2028-01-30', to: '2028-03-04' }], // leap year
    ['month', '2026-02-10', { from: '2026-02-01', to: '2026-02-28' }], // exactly four weeks
    ['month', '2026-08-15', { from: '2026-07-26', to: '2026-09-05' }], // six weeks
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
    expect(showsToday('week', THURSDAY, '2026-10-18')).toBe(false);
    expect(showsToday('month', THURSDAY, '2026-10-31')).toBe(true);
    expect(showsToday('day', THURSDAY, '2026-10-16')).toBe(false);
  });

  // The grid draws September's last days in October's first row, but those are
  // not "this month": the Today button must stay live to take you to them.
  it('does not count a neighbouring month’s days that the month grid pads with', () => {
    expect(showsToday('month', THURSDAY, '2026-09-28')).toBe(false);
    expect(showsToday('month', THURSDAY, '2026-10-01')).toBe(true);
  });
});

describe('rangeLabel', () => {
  it.each([
    ['day', THURSDAY, 'Thu, Oct 15, 2026'],
    ['week', THURSDAY, 'Oct 11 – 17, 2026'],
    ['week', '2026-09-30', 'Sep 27 – Oct 3, 2026'],
    ['week', '2026-12-30', 'Dec 27, 2026 – Jan 2, 2027'],
    // Named for the month itself, not the September day its grid starts on.
    ['month', THURSDAY, 'October 2026'],
    ['month', '2026-10-31', 'October 2026'],
  ] as const)('%s around %s reads "%s"', (view, anchor, want) => {
    expect(rangeLabel(view, anchor)).toBe(want);
  });
});

describe('columnsFor', () => {
  it('lays a week out as seven days, Sunday first, flagging today', () => {
    const cols = columnsFor('week', THURSDAY, THURSDAY);
    expect(cols).toHaveLength(7);
    expect(cols.map((c) => c.label)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(cols[0]).toMatchObject({
      key: WEEK_START, subLabel: 'Oct 11', date: WEEK_START, dayOfMonth: 11, monthAbbr: 'Oct',
    });
    expect(cols.filter((c) => c.isToday).map((c) => c.key)).toEqual([THURSDAY]);
    expect(cols.every((c) => c.inMonth)).toBe(true);
  });

  it('lays a month out as whole weeks, marking the days of the neighbouring months', () => {
    const cols = columnsFor('month', THURSDAY, '2026-10-15');
    expect(cols).toHaveLength(35);
    expect(cols[0]).toMatchObject({ key: '2026-09-27', label: 'Sun', inMonth: false });
    expect(cols[3]).toMatchObject({ key: '2026-09-30', inMonth: false });
    expect(cols[4]).toMatchObject({ key: '2026-10-01', dayOfMonth: 1, monthAbbr: 'Oct', inMonth: true });
    expect(cols[34]).toMatchObject({ key: '2026-10-31', label: 'Sat', inMonth: true });
    expect(cols.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it.each([
    ['2026-02-10', 28],
    ['2028-02-10', 35],
    ['2026-08-15', 42],
  ])('gives %s a grid of %i days', (anchor, count) => {
    expect(columnsFor('month', anchor, '2026-10-15')).toHaveLength(count);
  });

  it('lays a day out as the one day', () => {
    const cols = columnsFor('day', THURSDAY, '2026-10-15');
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({ key: THURSDAY, label: 'Thu', subLabel: 'Oct 15', isToday: true });
  });
});

describe('weeksOf', () => {
  it('cuts a month grid into rows of seven', () => {
    const weeks = weeksOf(columnsFor('month', THURSDAY, THURSDAY));
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].key).toBe('2026-09-27');
    expect(weeks[4][6].key).toBe('2026-10-31');
  });
});

describe('columnName', () => {
  it('names a day by weekday and date', () => {
    expect(columnName(columnsFor('week', THURSDAY, THURSDAY)[4])).toBe('Thu, Oct 15');
    expect(columnName(columnsFor('day', THURSDAY, THURSDAY)[0])).toBe('Thu, Oct 15');
  });
});
