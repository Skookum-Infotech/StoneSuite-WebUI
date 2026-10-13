import { describe, it, expect } from 'vitest';
import {
  INSTALL_DATE_INVALID_MESSAGE,
  INSTALL_DATE_PAST_MESSAGE,
  INSTALL_DATE_REQUIRED_MESSAGE,
  displayStatus,
  earliestInstallDate,
  formatWallClock,
  installDateError,
  joinWallClock,
  scheduleProgress,
  splitWallClock,
  wallClockNow,
} from './salesOrderSchedule';
import type { SalesOrderScheduleActivity } from '@/types/salesOrder';

// A fixed local "now": Oct 12 2026, 14:30. Built from parts so it is local in any zone.
const NOW = new Date(2026, 9, 12, 14, 30);

function activity(over: Partial<SalesOrderScheduleActivity>): SalesOrderScheduleActivity {
  return {
    code: 'saw',
    sequence: 6,
    group: 'Saw',
    name: 'Saw',
    status: 'pending',
    scheduledAt: '2026-10-25T09:00:00',
    notes: '',
    ...over,
  };
}

describe('installDateError', () => {
  it.each([
    ['today', '2026-10-12', undefined, ''],
    ['tomorrow', '2026-10-13', undefined, ''],
    ['a date well ahead', '2027-03-01', undefined, ''],
    ['yesterday', '2026-10-11', undefined, INSTALL_DATE_PAST_MESSAGE],
    ['last year', '2025-10-12', undefined, INSTALL_DATE_PAST_MESSAGE],
    ['blank', '', undefined, INSTALL_DATE_REQUIRED_MESSAGE],
    ['whitespace', '   ', undefined, INSTALL_DATE_REQUIRED_MESSAGE],
    ['not a string', undefined, undefined, INSTALL_DATE_REQUIRED_MESSAGE],
    ['an impossible date', '2026-02-30', undefined, INSTALL_DATE_INVALID_MESSAGE],
    ['the wrong shape', '12/10/2026', undefined, INSTALL_DATE_INVALID_MESSAGE],
    ['the saved date, once it is in the past', '2026-09-01', '2026-09-01', ''],
    ['a different past date than the saved one', '2026-09-02', '2026-09-01', INSTALL_DATE_PAST_MESSAGE],
    ['a future date different from the saved one', '2026-12-01', '2026-09-01', ''],
  ])('%s', (_name, value, saved, expected) => {
    expect(installDateError(value, saved, NOW)).toBe(expected);
  });

  it('compares calendar days, so late evening today is still today', () => {
    const lateEvening = new Date(2026, 9, 12, 23, 59);
    expect(installDateError('2026-10-12', undefined, lateEvening)).toBe('');
    expect(earliestInstallDate(lateEvening)).toBe('2026-10-12');
  });
});

describe('wall-clock values', () => {
  it('splits a server value into date and time, dropping seconds', () => {
    expect(splitWallClock('2026-11-10T17:00:00')).toEqual({ date: '2026-11-10', time: '17:00' });
    expect(splitWallClock('2026-11-10T09:05')).toEqual({ date: '2026-11-10', time: '09:05' });
    expect(splitWallClock('2026-11-10 09:05:30')).toEqual({ date: '2026-11-10', time: '09:05' });
  });

  it.each([undefined, '', 'tomorrow', '2026-11-10', '2026-11-10T9:00'])('rejects %j', (value) => {
    expect(splitWallClock(value)).toBeNull();
    expect(formatWallClock(value)).toBe('');
  });

  it('joins a date and time into the API form', () => {
    expect(joinWallClock('2026-11-10', '09:00')).toBe('2026-11-10T09:00');
  });

  it.each([
    ['2026-11-10T09:00:00', 'Nov 10, 2026, 9:00 AM'],
    ['2026-11-10T17:00:00', 'Nov 10, 2026, 5:00 PM'],
    ['2026-01-02T00:05:00', 'Jan 2, 2026, 12:05 AM'],
    ['2026-12-31T12:00:00', 'Dec 31, 2026, 12:00 PM'],
  ])('formats %s as %s without any timezone shift', (value, expected) => {
    expect(formatWallClock(value)).toBe(expected);
  });

  it('reads the viewer\'s clock as a wall-clock string', () => {
    expect(wallClockNow(NOW)).toBe('2026-10-12T14:30');
  });
});

describe('displayStatus', () => {
  it('shows a completed row as completed whatever its date', () => {
    expect(displayStatus(activity({ status: 'completed', scheduledAt: '2026-01-01T09:00:00' }), NOW)).toBe('completed');
  });

  it('shows a future pending row as pending', () => {
    expect(displayStatus(activity({ scheduledAt: '2026-10-25T09:00:00' }), NOW)).toBe('pending');
  });

  it('shows a pending row whose time has passed as overdue', () => {
    expect(displayStatus(activity({ scheduledAt: '2026-10-12T09:00:00' }), NOW)).toBe('overdue');
    expect(displayStatus(activity({ scheduledAt: '2026-10-11T17:00:00' }), NOW)).toBe('overdue');
  });

  it('is not overdue later the same day', () => {
    expect(displayStatus(activity({ scheduledAt: '2026-10-12T17:00:00' }), NOW)).toBe('pending');
  });

  it('keeps an in-progress row in progress even once its time has passed', () => {
    expect(displayStatus(activity({ status: 'in_progress', scheduledAt: '2026-10-01T09:00:00' }), NOW)).toBe('in_progress');
  });

  it('falls back to pending for a pending row with no readable time', () => {
    expect(displayStatus(activity({ scheduledAt: '' }), NOW)).toBe('pending');
  });
});

describe('scheduleProgress', () => {
  it('counts completed, in-progress and overdue rows', () => {
    const rows = [
      activity({ code: 'a', status: 'completed' }),
      activity({ code: 'b', status: 'completed' }),
      activity({ code: 'c', scheduledAt: '2026-10-01T09:00:00' }),
      activity({ code: 'd', scheduledAt: '2026-10-30T09:00:00' }),
      activity({ code: 'e', status: 'in_progress', scheduledAt: '2026-10-01T09:00:00' }),
    ];
    expect(scheduleProgress(rows, NOW)).toEqual({ total: 5, completed: 2, inProgress: 1, overdue: 1 });
  });

  it('handles an empty schedule', () => {
    expect(scheduleProgress([], NOW)).toEqual({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  });
});
