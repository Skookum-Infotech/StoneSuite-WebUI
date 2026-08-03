// Predicts the fiscal year GenerateFiscalYear will create, purely from data
// already on screen (the last known fiscal year's end date) — so the
// "Generate Fiscal Year" dialog can show what will happen before the user
// confirms, without a preview endpoint. Mirrors the exact rules in
// StoneSuite-Backend's accountingperiod/calendar.go and store_generate.go's
// nextFiscalYearStart: next year starts the day after the last one ends,
// normalized to the first of that month, and always runs twelve calendar
// months. All math is UTC-only (Date.UTC / getUTC*), matching the backend's
// time.UTC-normalized columns — never local-timezone Date parsing, which is
// exactly the bug monthYearToRfc3339 (lib/monthYearValue.ts) was written to
// avoid.

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function lastOfMonthUTC(d: Date): Date {
  const first = firstOfMonthUTC(d);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
}

function addUTCDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function addUTCMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

/** Mirrors accountingperiod.FiscalYearLabel: labelled by the year it ends in,
 *  except a calendar-year (January-start) fiscal year, labelled by its own
 *  year. `start` must already be the first of its month. */
function fiscalYearLabel(start: Date): string {
  const year = start.getUTCFullYear();
  return start.getUTCMonth() === 0 ? `FY${year}` : `FY${year + 1}`;
}

export interface FiscalYearPreview {
  name: string;
  start: string; // ISO
  end: string; // ISO
}

/** Predicts the next fiscal year from the latest known one's end date.
 *  Returns null when there is no fiscal year yet — GenerateFiscalYear only
 *  ever runs once a calendar (and its first year) already exists via Setup,
 *  so this is a defensive case, not an expected one. */
export function predictNextFiscalYear(lastFiscalYearEnd: string | undefined): FiscalYearPreview | null {
  if (!lastFiscalYearEnd) return null;
  const nextStart = firstOfMonthUTC(addUTCDays(new Date(lastFiscalYearEnd), 1));
  const end = lastOfMonthUTC(addUTCMonths(nextStart, 11));
  return { name: fiscalYearLabel(nextStart), start: nextStart.toISOString(), end: end.toISOString() };
}

/** Predicts `count` contiguous fiscal years, chaining each predicted year's
 *  end into the next — mirrors what a multi-year GenerateFiscalYear request
 *  will actually create. Returns [] when there is no fiscal year yet, same
 *  defensive case predictNextFiscalYear guards against. */
export function predictNextFiscalYears(lastFiscalYearEnd: string | undefined, count: number): FiscalYearPreview[] {
  const previews: FiscalYearPreview[] = [];
  let cursor = lastFiscalYearEnd;
  for (let i = 0; i < count; i++) {
    const next = predictNextFiscalYear(cursor);
    if (!next) return previews;
    previews.push(next);
    cursor = next.end;
  }
  return previews;
}
