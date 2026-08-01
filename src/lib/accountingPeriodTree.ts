// Pure grouping/formatting helpers behind the Accounting Periods tree view.
// No React, no network — the FY -> quarter -> month tree, expand/collapse
// flattening, and date-range formatting all live here so they're unit
// testable without mounting the table.
import { LOCK_STATUS_FIELDS, type FiscalYear, type LockDimension, type Period, type PeriodStatus }
  from '@/types/accountingPeriod';

/** A group row's three sub-ledger columns. The backend derives a status for a
 *  fiscal year and a quarter, but no per-lock rollup for either, so these are
 *  computed here over the periods the group actually contains — which under an
 *  active filter is the visible subset, the same scope the quarter status has
 *  always been derived over. */
export type LockRollup = Record<LockDimension, PeriodStatus>;

export interface QuarterNode {
  key: string;
  quarterNumber: 1 | 2 | 3 | 4;
  label: string;
  start: string;
  end: string;
  status: PeriodStatus;
  locks: LockRollup;
  periods: Period[];
}

export interface FiscalYearNode {
  key: string;
  fiscalYear: FiscalYear;
  locks: LockRollup;
  quarters: QuarterNode[];
}

export type PeriodTreeRow =
  | { level: 'year'; key: string; node: FiscalYearNode; collapsed: boolean }
  | { level: 'quarter'; key: string; node: QuarterNode; fiscalYearName: string; collapsed: boolean }
  | { level: 'month'; key: string; period: Period };

/** 1-12 -> 1-4. Periods are always the twelve calendar months of a fiscal
 *  year (accountingperiod.PeriodsPerYear); a quarter is a reporting rollup
 *  derived here, never a stored or independently closable unit. */
export function quarterNumber(periodNumber: number): 1 | 2 | 3 | 4 {
  return Math.ceil(periodNumber / 3) as 1 | 2 | 3 | 4;
}

/** "FY2026" -> "2026" — the calendar year the fiscal year is labelled by
 *  (accountingperiod.FiscalYearLabel: the year it ENDS in). */
export function fiscalYearNumeral(fiscalYearName: string): string {
  return fiscalYearName.replace(/^FY/i, '');
}

/** "FY2026" -> "FY 2026", matching the reference tree's spaced year rows. */
export function fiscalYearDisplayLabel(fiscalYearName: string): string {
  return `FY ${fiscalYearNumeral(fiscalYearName)}`;
}

export function quarterLabel(fiscalYearName: string, q: number): string {
  return `Q${q} ${fiscalYearNumeral(fiscalYearName)}`;
}

/** Closed only when every period in the group is closed; open on an empty
 *  group. Mirrors accountingperiod.DeriveYearStatus so a quarter can't read
 *  "closed" on the strength of having no periods. */
export function deriveRollupStatus(periods: { status: PeriodStatus }[]): PeriodStatus {
  if (periods.length === 0) return 'open';
  return periods.every((p) => p.status === 'closed') ? 'closed' : 'open';
}

/** The same all-or-nothing rollup as deriveRollupStatus, applied to each of
 *  the three sub-ledger locks independently — a group can be closed on GL and
 *  open on AP, which is the whole point of the locks being separate. */
export function deriveLockRollup(periods: Period[]): LockRollup {
  const rollupFor = (dimension: LockDimension): PeriodStatus => {
    if (periods.length === 0) return 'open';
    const field = LOCK_STATUS_FIELDS[dimension];
    return periods.every((p) => p[field] === 'closed') ? 'closed' : 'open';
  };
  return { ap: rollupFor('ap'), ar: rollupFor('ar'), gl: rollupFor('gl') };
}

function fmtDay(iso: string): string {
  // Locale is pinned rather than left as the runtime default: the default
  // varies between environments (e.g. local dev vs. CI), which made this
  // format non-deterministic across machines.
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Always renders both full dates rather than eliding a shared year — a
 *  fiscal year commonly spans two calendar years, and eliding the year would
 *  misread as "these are the same year" for those tenants. */
export function formatDateRange(startIso: string, endIso: string): string {
  return `${fmtDay(startIso)} – ${fmtDay(endIso)}`;
}

/** Groups a flat period list into fiscal years -> quarters of up to three
 *  months each, preserving the order the backend already returns (period
 *  rows sorted by period_start ascending). A period whose fiscalYearId
 *  matches no listed fiscal year is dropped rather than guessed into a
 *  synthetic year.
 *
 *  Grouping stays keyed on periodNumber rather than the server's quarterId:
 *  the two agree by construction (the backend assigns periods 1-3 to Q1 and
 *  so on), and periodNumber is the only one present on periods generated
 *  before fiscal_quarter existed — those carry a null quarterId and are
 *  deliberately never backfilled. The server's quarterName is preferred for
 *  the label whenever it is there, so a tenant sees the name their own rows
 *  actually carry. */
export function buildFiscalYearTree(fiscalYears: FiscalYear[], periods: Period[]): FiscalYearNode[] {
  return fiscalYears.map((fy) => {
    const fyPeriods = periods
      .filter((p) => p.fiscalYearId === fy.id)
      .sort((a, b) => a.periodNumber - b.periodNumber);

    const quarters: QuarterNode[] = [];
    for (let q = 1; q <= 4; q++) {
      const qPeriods = fyPeriods.filter((p) => quarterNumber(p.periodNumber) === q);
      if (qPeriods.length === 0) continue;
      quarters.push({
        key: `${fy.id}-q${q}`,
        quarterNumber: q as 1 | 2 | 3 | 4,
        label: qPeriods.find((p) => p.quarterName)?.quarterName ?? quarterLabel(fy.name, q),
        start: qPeriods[0].start,
        end: qPeriods[qPeriods.length - 1].end,
        status: deriveRollupStatus(qPeriods),
        locks: deriveLockRollup(qPeriods),
        periods: qPeriods,
      });
    }
    return { key: fy.id, fiscalYear: fy, locks: deriveLockRollup(fyPeriods), quarters };
  });
}

/** Expands the FY -> quarter -> month tree into the rows the table renders,
 *  skipping the children of anything in `collapsed`. */
export function flattenTree(nodes: FiscalYearNode[], collapsed: ReadonlySet<string>): PeriodTreeRow[] {
  const rows: PeriodTreeRow[] = [];
  for (const yearNode of nodes) {
    const yearCollapsed = collapsed.has(yearNode.key);
    rows.push({ level: 'year', key: yearNode.key, node: yearNode, collapsed: yearCollapsed });
    if (yearCollapsed) continue;

    for (const q of yearNode.quarters) {
      const qCollapsed = collapsed.has(q.key);
      rows.push({ level: 'quarter', key: q.key, node: q, fiscalYearName: yearNode.fiscalYear.name, collapsed: qCollapsed });
      if (qCollapsed) continue;

      for (const period of q.periods) {
        rows.push({ level: 'month', key: period.id, period });
      }
    }
  }
  return rows;
}

/** Every year and quarter key in the tree — what "Collapse All" collapses to
 *  and "Expand All" clears back to none. */
export function allGroupKeys(nodes: FiscalYearNode[]): string[] {
  const keys: string[] = [];
  for (const yearNode of nodes) {
    keys.push(yearNode.key);
    for (const q of yearNode.quarters) keys.push(q.key);
  }
  return keys;
}
