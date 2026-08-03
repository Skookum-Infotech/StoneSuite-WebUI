// Accounting Periods module — frontend contract types.
//
// Mirrors the dedicated relational backend module
// (`StoneSuite-Backend/accountingperiod/types.go`), served from
// `/api/tenant/finance/*`. Tenant-global master data — a fiscal calendar,
// generated fiscal years, and their monthly periods — with no owner column
// and no per-record IDOR scope, same shape as chartofaccounts.

export type PeriodStatus = 'open' | 'closed';

/** The three independent sub-ledger locks a period carries. `accounting_period_status`
 *  is DERIVED from them server-side — closed iff all three are closed — so none of
 *  them may be treated as an alias of the overall status. */
export type LockDimension = 'ap' | 'ar' | 'gl';

/** What a close/reopen acts on: the whole period (the existing
 *  /close + /reopen pair) or one sub-ledger lock. */
export type LockTarget = 'period' | LockDimension;

export const LOCK_DIMENSIONS: readonly LockDimension[] = ['ap', 'ar', 'gl'];

/** Column/dialog copy per target. Mirrors the reference tree's column names. */
export const LOCK_TARGET_LABELS: Record<LockTarget, string> = {
  period: 'Period Close',
  ap: 'A/P Transactions',
  ar: 'A/R Transactions',
  gl: 'All G/L Transactions',
};

/** The field on Period each lock dimension reads. */
export const LOCK_STATUS_FIELDS: Record<LockDimension, 'apLockStatus' | 'arLockStatus' | 'glLockStatus'> = {
  ap: 'apLockStatus',
  ar: 'arLockStatus',
  gl: 'glLockStatus',
};

/** Configured is false on every tenant that has never run Setup. */
export interface AccountingCalendar {
  configured: boolean;
  fiscalYearStartMonth?: number;
  basePeriodStart?: string; // ISO date, first day of the go-live month
  booksClosedThrough?: string; // ISO date
  configuredAt?: string;
}

/** Status is derived server-side — closed only when all twelve periods are.
 *  `quarters` is populated on the generate response only; GET /fiscal-years
 *  does not join them, so the tree derives quarter grouping from each
 *  period's own quarterId/quarterName (lib/accountingPeriodTree.ts). */
export interface FiscalYear {
  id: string; // uuid
  name: string; // "FY2026"
  start: string; // ISO date
  end: string; // ISO date
  status: PeriodStatus;
  periods?: Period[];
  quarters?: Quarter[];
  createdAt: string;
  updatedAt: string;
}

/** Three consecutive periods. Status is derived server-side (closed iff all
 *  three of its periods are) and is never set directly — quarters have no
 *  lock of their own, so there is no AP/AR/GL field here. */
export interface Quarter {
  id: string; // uuid
  fiscalYearId: string;
  quarterNumber: number; // 1-4
  name: string; // "Q1 FY2026"
  start: string; // ISO date
  end: string; // ISO date
  status: PeriodStatus;
  createdAt: string;
  updatedAt: string;
}

/** One calendar month of a fiscal year. */
export interface Period {
  id: string; // uuid
  fiscalYearId: string;
  fiscalYearName: string;
  name: string; // "Feb 2025"
  periodNumber: number; // 1-12, position within the fiscal year
  start: string; // ISO date
  end: string; // ISO date
  /** Derived server-side from the three locks below — closed iff all three
   *  are. Never send it as a lock value; it has no setter of its own. */
  status: PeriodStatus;
  isBasePeriod: boolean;
  closedAt?: string;
  /** The three independent sub-ledger locks. Always present — unlike `status`
   *  these are stored, not derived. Only `glLockStatus` actually gates
   *  anything today (journal.CheckPeriodOpen reads it); AP and AR are
   *  first-class state with no consumer yet. */
  apLockStatus: PeriodStatus;
  arLockStatus: PeriodStatus;
  glLockStatus: PeriodStatus;
  /** Absent on periods generated before quarters existed — fiscal_quarter_id
   *  is nullable and deliberately not backfilled. */
  quarterId?: string;
  quarterName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodFilters {
  fiscalYear?: string; // fiscal_year_name, e.g. "FY2026"
  status?: PeriodStatus;
}

/** fiscalYearStartMonth is 1-12; basePeriodStart is normalized to the first
 *  of its month server-side, so any date within the intended month works.
 *  Must be a full RFC3339 instant (e.g. "2026-03-01T00:00:00.000Z") — the
 *  Go field behind it is `*time.Time`, which rejects a bare "2026-03-01"
 *  outright. Build it with `monthYearToRfc3339` (lib/monthYearValue.ts). */
export interface CalendarSetupPayload {
  fiscalYearStartMonth: number;
  basePeriodStart: string;
}

/** MaxGenerateYears mirrors StoneSuite-Backend's accountingperiod.MaxGenerateYears
 *  — the most contiguous fiscal years one request may generate. */
export const MAX_GENERATE_YEARS = 10;

/** StartYear is a confirmation, not a choice — omit it to generate whatever
 *  year contiguously follows the latest one on record. Years is the real
 *  choice: how many contiguous years to generate in one atomic request
 *  (1-MAX_GENERATE_YEARS, omit or 0 for a single year). */
export interface GenerateFiscalYearPayload {
  startYear?: number;
  years?: number;
}

/** A one-element periodIds is the single-period close/reopen case — there is
 *  no separate endpoint for it. The six lock endpoints take the same shape. */
export interface StatusChangePayload {
  periodIds: string[];
  note?: string;
}

export interface StatusChangeResult {
  periods: Period[];
  booksClosedThrough: string | null;
}

/** Every action `accounting_period_history` records. The six lock verbs are
 *  written one row per period per call, exactly like close/reopen. */
export type PeriodHistoryAction =
  | 'generate' | 'close' | 'reopen' | 'base_setup'
  | 'ap_lock' | 'ap_unlock' | 'ar_lock' | 'ar_unlock' | 'gl_lock' | 'gl_unlock';

/** One audited change to a period. `by` is an employee id, not a name —
 *  resolve via lookupService's employees list, same as AccountHistoryEntry. */
export interface PeriodHistoryEntry {
  id: number;
  periodId: string;
  action: PeriodHistoryAction;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  by?: number | null;
  at: string;
}
