import { tenantClient } from '@/api/tenantClient';
import type {
  AccountingCalendar, FiscalYear, Period, PeriodFilters, PeriodHistoryEntry,
  CalendarSetupPayload, GenerateFiscalYearPayload, StatusChangePayload, StatusChangeResult,
} from '@/types/accountingPeriod';

// Accounting Periods module API wrapper. Talks to the dedicated relational
// module under `/api/tenant/finance/*` — mirrors chartOfAccountsService.ts.
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy and RBAC (`accounting_period:*`).
const BASE = '/tenant/finance';

function toResult(data: { periods?: Period[] | null; booksClosedThrough?: string | null }): StatusChangeResult {
  return { periods: data.periods ?? [], booksClosedThrough: data.booksClosedThrough ?? null };
}

export const accountingPeriodService = {
  // GET /accounting-calendar — configured=false means Setup has never run.
  getCalendar: (): Promise<AccountingCalendar> =>
    tenantClient
      .get<{ success: boolean; calendar: AccountingCalendar }>(`${BASE}/accounting-calendar`)
      .then((r) => r.data.calendar),

  // POST /accounting-calendar/setup — one-time, gated on accounting_period:configure.
  // A second call 409s; the caller must not retry it as if it were idempotent.
  setupCalendar: (payload: CalendarSetupPayload): Promise<FiscalYear> =>
    tenantClient
      .post<{ success: boolean; fiscalYear: FiscalYear }>(`${BASE}/accounting-calendar/setup`, payload)
      .then((r) => r.data.fiscalYear),

  // GET /fiscal-years — every generated year, oldest first, status derived server-side.
  listFiscalYears: (): Promise<FiscalYear[]> =>
    tenantClient
      .get<{ success: boolean; fiscalYears: FiscalYear[] | null }>(`${BASE}/fiscal-years`)
      .then((r) => r.data.fiscalYears ?? []),

  // POST /fiscal-years — generates one or more contiguous years' twelve
  // periods each in one atomic request, gated on accounting_period:create
  // (separate from :update's close/reopen). Always returns an array, even
  // for the single-year case.
  generateFiscalYear: (payload: GenerateFiscalYearPayload = {}): Promise<FiscalYear[]> =>
    tenantClient
      .post<{ success: boolean; fiscalYears: FiscalYear[] }>(`${BASE}/fiscal-years`, payload)
      .then((r) => r.data.fiscalYears),

  // GET /accounting-periods?fiscalYear=&status= — chronological, oldest first.
  listPeriods: (filters: PeriodFilters = {}): Promise<Period[]> =>
    tenantClient
      .get<{ success: boolean; periods: Period[] | null }>(`${BASE}/accounting-periods`, { params: filters })
      .then((r) => r.data.periods ?? []),

  // GET /accounting-periods/current — null period (200, not 404) when no
  // generated period covers today.
  getCurrentPeriod: (): Promise<Period | null> =>
    tenantClient
      .get<{ success: boolean; period: Period | null }>(`${BASE}/accounting-periods/current`)
      .then((r) => r.data.period),

  getPeriod: (uuid: string): Promise<Period> =>
    tenantClient
      .get<{ success: boolean; period: Period }>(`${BASE}/accounting-periods/${uuid}`)
      .then((r) => r.data.period),

  // GET /accounting-periods/{uuid}/history — newest first.
  getPeriodHistory: (uuid: string, limit?: number): Promise<PeriodHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; history: PeriodHistoryEntry[] | null }>(
        `${BASE}/accounting-periods/${uuid}/history`,
        { params: limit ? { limit } : undefined },
      )
      .then((r) => r.data.history ?? []),

  // POST /accounting-periods/close — one or many, oldest-first, one transaction.
  // A sequencing violation 409s the whole batch; render the message verbatim.
  closePeriods: (payload: StatusChangePayload): Promise<StatusChangeResult> =>
    tenantClient
      .post<{ success: boolean; periods: Period[] | null; booksClosedThrough: string | null }>(
        `${BASE}/accounting-periods/close`,
        payload,
      )
      .then((r) => toResult(r.data)),

  // POST /accounting-periods/reopen — one or many, newest-first, one transaction.
  reopenPeriods: (payload: StatusChangePayload): Promise<StatusChangeResult> =>
    tenantClient
      .post<{ success: boolean; periods: Period[] | null; booksClosedThrough: string | null }>(
        `${BASE}/accounting-periods/reopen`,
        payload,
      )
      .then((r) => toResult(r.data)),
};
