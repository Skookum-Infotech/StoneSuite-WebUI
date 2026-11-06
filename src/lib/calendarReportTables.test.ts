import { describe, it, expect } from 'vitest';
import {
  formatAvgLate,
  formatDayCount,
  formatOverdueDays,
  leadTimeReportTable,
  onTimeReportTable,
  overdueReportTable,
  upcomingReportTable,
} from './calendarReportTables';

const WINDOW = { from: '2026-01-01', to: '2026-01-31' };

describe('day formatting', () => {
  it.each([
    [0, 'Due today'],
    [-2, 'Due today'],
    [1, '1 day'],
    [9, '9 days'],
  ])('formatOverdueDays(%d) -> %s', (days, want) => {
    expect(formatOverdueDays(days)).toBe(want);
  });

  it('formats averages with one decimal and dashes a missing one', () => {
    expect(formatDayCount(8)).toBe('8.0');
    expect(formatDayCount(17.55)).toBe('17.6');
    expect(formatAvgLate(null)).toBe('—');
    expect(formatAvgLate(2)).toBe('2.0');
  });
});

describe('report tables', () => {
  it('upcoming table labels the source and dashes a missing crew lead', () => {
    const t = upcomingReportTable({
      weeks: 8,
      perWeek: [],
      rows: [
        { orderId: 'a', order: 'SORD-1', customer: 'Acme', day: '2026-11-10', weekStart: '2026-11-09', source: 'plan', lead: '' },
        { orderId: 'b', order: 'SORD-2', customer: 'Beta', day: '2026-11-11', weekStart: '2026-11-09', source: 'appointment', lead: 'Sam Crew' },
      ],
    });
    expect(t.rows.map((r) => r[3])).toEqual(['Planned date', 'Booked visit']);
    expect(t.rows.map((r) => r[4])).toEqual(['—', 'Sam Crew']);
    expect(t.subtitle).toContain('8 weeks');
    for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
  });

  it('overdue table lines up with its headers', () => {
    const t = overdueReportTable({
      totals: { activities: 1, orders: 1, oldestDays: 7, byActivity: [] },
      rows: [{ orderId: 'a', order: 'SORD-1', customer: 'Acme', orderStatus: 'Open', code: 'template', activity: 'Template', scheduledAt: '2026-10-30T09:00:00Z', daysOverdue: 7 }],
    });
    expect(t.rows[0]).toHaveLength(t.headers.length);
    expect(t.rows[0][5]).toBe('7 days');
  });

  it('on-time table totals the percentage', () => {
    const t = onTimeReportTable(
      {
        totals: { completed: 4, onTime: 3, late: 1, onTimePercent: 75 },
        rows: [{ code: 'saw', activity: 'Saw', completed: 4, onTime: 3, late: 1, onTimePercent: 75, avgDaysLate: 2 }],
      },
      WINDOW,
    );
    expect(t.rows[0]).toEqual(['Saw', '4', '3', '1', '75.0%', '2.0']);
    expect(t.totalsRow).toHaveLength(t.headers.length);
    expect(t.totalsRow?.[4]).toBe('75.0%');
  });

  it('lead time table shows days per month and the overall average', () => {
    const t = leadTimeReportTable(
      {
        totals: { orders: 4, avgDays: 17.5, minDays: 10, maxDays: 30 },
        rows: [{ period: '2026-01-01', orders: 4, avgDays: 17.5, medianDays: 16, minDays: 10, maxDays: 30 }],
      },
      WINDOW,
    );
    expect(t.rows[0].slice(1)).toEqual(['4', '17.5', '16.0', '10', '30']);
    expect(t.totalsRow).toHaveLength(t.headers.length);
  });
});
