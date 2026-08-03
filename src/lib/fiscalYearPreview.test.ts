import { describe, it, expect } from 'vitest';
import { predictNextFiscalYear, predictNextFiscalYears } from './fiscalYearPreview';

describe('predictNextFiscalYear', () => {
  it('returns null when no fiscal year exists yet', () => {
    expect(predictNextFiscalYear(undefined)).toBeNull();
  });

  it('predicts the next calendar-year fiscal year (January start)', () => {
    // FY2026 = 2026-01-01..2026-12-31 -> next is FY2027.
    expect(predictNextFiscalYear('2026-12-31')).toEqual({
      name: 'FY2027',
      start: '2027-01-01T00:00:00.000Z',
      end: '2027-12-31T00:00:00.000Z',
    });
  });

  it('predicts the next fiscal year straddling two calendar years (April start)', () => {
    // A fiscal year 2026-04-01..2027-03-31 is labelled by the year it ends
    // in (FY2027, per accountingperiod.FiscalYearLabel) -> next is FY2028.
    expect(predictNextFiscalYear('2027-03-31')).toEqual({
      name: 'FY2028',
      start: '2027-04-01T00:00:00.000Z',
      end: '2028-03-31T00:00:00.000Z',
    });
  });

  it('normalizes to the first of the month even given a mid-month end (defensive)', () => {
    const result = predictNextFiscalYear('2026-02-28');
    expect(result?.start).toBe('2026-03-01T00:00:00.000Z');
  });

  it('handles a fiscal year end that falls in a leap-day month correctly', () => {
    // FY ending 2028-02-29 (leap year) -> next starts 2028-03-01.
    const result = predictNextFiscalYear('2028-02-29');
    expect(result?.start).toBe('2028-03-01T00:00:00.000Z');
  });
});

describe('predictNextFiscalYears', () => {
  it('returns [] when no fiscal year exists yet', () => {
    expect(predictNextFiscalYears(undefined, 3)).toEqual([]);
  });

  it('returns [] for a zero count', () => {
    expect(predictNextFiscalYears('2026-12-31', 0)).toEqual([]);
  });

  it('chains contiguous years, each starting the day after the previous ends', () => {
    const years = predictNextFiscalYears('2026-12-31', 3);
    expect(years.map((y) => y.name)).toEqual(['FY2027', 'FY2028', 'FY2029']);
    expect(years[0].start).toBe('2027-01-01T00:00:00.000Z');
    expect(years[0].end).toBe('2027-12-31T00:00:00.000Z');
    expect(years[1].start).toBe('2028-01-01T00:00:00.000Z');
    expect(years[2].end).toBe('2029-12-31T00:00:00.000Z');
  });

  it('matches predictNextFiscalYear for a count of 1', () => {
    expect(predictNextFiscalYears('2026-12-31', 1)).toEqual([predictNextFiscalYear('2026-12-31')]);
  });
});
