// Sorts an InviteUser (POST /tenant/users/invite) failure into a shape the
// modal can render deliberately, instead of painting every rejection red.
// Pure — no React, no network — mirrors coaErrors.ts / itemReceiptErrors.ts.
//
// Mirrors StoneSuite-Backend controllers/user.go InviteUser:
//   409 -> the email can't be invited (already a member, already has a pending
//          invite, or registered to another workspace) — not a failure the
//          admin did anything wrong to cause, so show it as information.
//   400 -> request validation (missing email, bad role) — inline field-level.
//   else -> a genuine failure (500, network, timeout) — show it as an error.
import { AxiosError } from 'axios';

export type InviteErrorKind = 'conflict' | 'validation' | 'generic';

export interface InviteErrorInfo {
  kind: InviteErrorKind;
  message: string;
}

export function parseInviteError(
  err: unknown,
  fallback = 'Failed to send invitation.',
): InviteErrorInfo {
  if (!(err instanceof AxiosError)) {
    return { kind: 'generic', message: err instanceof Error ? err.message : fallback };
  }

  const status = err.response?.status;
  const data = err.response?.data as { message?: string } | undefined;
  const message = data?.message ?? err.message ?? fallback;

  if (status === 409) return { kind: 'conflict', message };
  if (status === 400) return { kind: 'validation', message };
  return { kind: 'generic', message };
}
