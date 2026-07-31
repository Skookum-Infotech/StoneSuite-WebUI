// Accounting Periods module — frontend contract types.
//
// Mirrors the dedicated relational backend module
// (`StoneSuite-Backend/accountingperiod/types.go`), served from
// `/api/tenant/finance/*`. Tenant-global master data — a fiscal calendar,
// generated fiscal years, and their monthly periods — with no owner column
// and no per-record IDOR scope, same shape as chartofaccounts.

export type PeriodStatus = 'open' | 'closed';

/** Configured is false on every tenant that has never run Setup. */
export interface AccountingCalendar {
  configured: boolean;
  fiscalYearStartMonth?: number;
  basePeriodStart?: string; // ISO date, first day of the go-live month
  booksClosedThrough?: string; // ISO date
  configuredAt?: string;
}

/** Status is derived server-side — closed only when all twelve periods are. */
export interface FiscalYear {
  id: string; // uuid
  name: string; // "FY2026"
  start: string; // ISO date
  end: string; // ISO date
  status: PeriodStatus;
  periods?: Period[];
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
  status: PeriodStatus;
  isBasePeriod: boolean;
  closedAt?: string;
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

/** StartYear is a confirmation, not a choice — omit it to generate whatever
 *  year contiguously follows the latest one on record. */
export interface GenerateFiscalYearPayload {
  startYear?: number;
}

/** A one-element periodIds is the single-period close/reopen case — there is
 *  no separate endpoint for it. */
export interface StatusChangePayload {
  periodIds: string[];
  note?: string;
}

export interface StatusChangeResult {
  periods: Period[];
  booksClosedThrough: string | null;
}

/** One audited change to a period. `by` is an employee id, not a name —
 *  resolve via lookupService's employees list, same as AccountHistoryEntry. */
export interface PeriodHistoryEntry {
  id: number;
  periodId: string;
  action: 'generate' | 'close' | 'reopen' | 'base_setup';
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  by?: number | null;
  at: string;
}
