// Parses the Chart of Accounts module's special-case error responses apart
// from an ordinary failure, so drawers/dialogs can render the right affordance
// instead of a generic message. Pure — no React, no network — mirrors
// itemReceiptErrors.ts.
//
// Mirrors StoneSuite-Backend controllers/chartofaccounts.go's coaFail:
//   404 -> generic "not found"
//   503 -> ErrCipherUnavailable (bank details can't be saved)
//   400 -> ClientError (validation)
//   409 -> ConflictError, optionally carrying blockingSlots (AD-7), or the
//          optimistic-concurrency "changed by someone else" message
import { AxiosError } from 'axios';

export type CoaErrorKind =
  | 'blockingSlots'      // 409 with blockingSlots — a default slot points at this account
  | 'versionConflict'    // 409 — recordVersion mismatch; reload, don't retry
  | 'conflict'           // 409 — some other state clash (e.g. repoint target not postable/active)
  | 'encryptionUnavailable' // 503 — SECRET_ENCRYPTION_KEY not configured
  | 'validation'         // 400 — ClientError
  | 'generic';

export interface CoaErrorInfo {
  kind: CoaErrorKind;
  message: string;
  /** Only present for kind === 'blockingSlots'. */
  blockingSlots?: string[];
}

// Must match the literal substring in store_update.go's ConflictError message.
const VERSION_CONFLICT_SUBSTRING = 'changed by someone else';

export function parseCoaError(err: unknown, fallback = 'Something went wrong.'): CoaErrorInfo {
  if (!(err instanceof AxiosError)) {
    return { kind: 'generic', message: err instanceof Error ? err.message : fallback };
  }

  const status = err.response?.status;
  const data = err.response?.data as { message?: string; blockingSlots?: string[] | null } | undefined;
  const message = data?.message ?? err.message ?? fallback;

  if (status === 503) return { kind: 'encryptionUnavailable', message };
  if (status === 400) return { kind: 'validation', message };
  if (status === 409) {
    const slots = (data?.blockingSlots ?? []).filter((s): s is string => Boolean(s));
    if (slots.length > 0) return { kind: 'blockingSlots', message, blockingSlots: slots };
    if (message.includes(VERSION_CONFLICT_SUBSTRING)) return { kind: 'versionConflict', message };
    return { kind: 'conflict', message };
  }
  return { kind: 'generic', message };
}
