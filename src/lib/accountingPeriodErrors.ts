// Parses the Accounting Periods module's special-case error responses apart
// from an ordinary failure. Pure — no React, no network — mirrors coaErrors.ts.
//
// Mirrors StoneSuite-Backend controllers/accountingperiod.go's apFail:
//   404 -> ErrNotFound ("Accounting period not found.")
//   400 -> ClientError (validation)
//   409 -> ErrNotConfigured, or a ConflictError (sequencing rule, already
//          closed/open, or already configured) — both carry a
//          user-actionable message the caller should render verbatim.
import { AxiosError } from 'axios';

export type AccountingPeriodErrorKind =
  | 'notConfigured' // 409 — the fiscal calendar has never been set up
  | 'sequencing' // 409 — a close/reopen ordering rule, or already open/closed
  | 'validation' // 400 — ClientError
  | 'notFound' // 404
  | 'generic';

export interface AccountingPeriodErrorInfo {
  kind: AccountingPeriodErrorKind;
  message: string;
}

// Must match the literal substring in controllers/accountingperiod.go's apFail.
const NOT_CONFIGURED_SUBSTRING = 'has not been set up yet';

export function parseAccountingPeriodError(
  err: unknown,
  fallback = 'Something went wrong.',
): AccountingPeriodErrorInfo {
  if (!(err instanceof AxiosError)) {
    return { kind: 'generic', message: err instanceof Error ? err.message : fallback };
  }

  const status = err.response?.status;
  const message = (err.response?.data as { message?: string } | undefined)?.message ?? err.message ?? fallback;

  if (status === 404) return { kind: 'notFound', message };
  if (status === 400) return { kind: 'validation', message };
  if (status === 409) {
    return { kind: message.includes(NOT_CONFIGURED_SUBSTRING) ? 'notConfigured' : 'sequencing', message };
  }
  return { kind: 'generic', message };
}
