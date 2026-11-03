import { AxiosError } from 'axios';
import type { AuthResponse, MfaChallenge } from '@/types/auth';

// Mirrors mfa.CodeLength on the backend; the server's `codeLength` wins where a
// response carries it, this is only the fallback and the input's cap.
export const MFA_CODE_LENGTH = 6;

// Stable reasons the backend puts in `code` (controllers/mfa.go).
export const MFA_ERROR = {
  codeFormat: 'mfa_code_format',
  codeInvalid: 'mfa_code_invalid',
  challengeExpired: 'mfa_challenge_expired',
  challengeLocked: 'mfa_challenge_locked',
  resendTooSoon: 'mfa_resend_too_soon',
  sendLimit: 'mfa_send_limit',
  sendFailed: 'mfa_send_failed',
  invalidPassword: 'invalid_password',
} as const;

// Keeps only digits and cuts to maxLength, so a pasted "123 456" or "123-456"
// lands as 123456 and a letter never makes it into the box.
export function digitsOnly(value: string, maxLength: number = MFA_CODE_LENGTH): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

// The challenge a password login opened, or null when the response is an
// ordinary login. Both fields below must be there for the code step to work:
// without the token nothing can be verified, without the address the screen
// cannot say where the code went.
export function toMfaChallenge(response: AuthResponse): MfaChallenge | null {
  if (!response.mfaRequired || !response.challengeToken || !response.maskedEmail) return null;
  return {
    success: true,
    challengeToken: response.challengeToken,
    maskedEmail: response.maskedEmail,
    codeLength: response.codeLength ?? MFA_CODE_LENGTH,
    expiresInSeconds: response.expiresInSeconds ?? 0,
    resendAfterSeconds: response.resendAfterSeconds ?? 0,
  };
}

export interface MfaErrorInfo {
  code?: string;
  message: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

interface MfaErrorBody {
  code?: string;
  message?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

// Pulls the machine-readable parts out of a failed MFA call. Anything that is
// not an API error response (a network drop, say) comes back as just the
// fallback message.
export function mfaErrorInfo(err: unknown, fallback: string): MfaErrorInfo {
  if (!(err instanceof AxiosError)) return { message: fallback };
  const body: MfaErrorBody = err.response?.data ?? {};
  return {
    code: body.code,
    message: body.message ?? fallback,
    attemptsLeft: body.attemptsLeft,
    retryAfterSeconds: body.retryAfterSeconds,
  };
}

// The challenge is gone for good (used, timed out, or too many wrong codes), so
// retyping can never work: the person has to start over.
export function isChallengeDead(code: string | undefined): boolean {
  return code === MFA_ERROR.challengeExpired || code === MFA_ERROR.challengeLocked;
}

// "That code isn't right." plus how many tries remain, when the server says.
export function wrongCodeMessage(info: MfaErrorInfo): string {
  if (info.attemptsLeft === undefined) return info.message;
  const noun = info.attemptsLeft === 1 ? 'attempt' : 'attempts';
  return `${info.message} ${info.attemptsLeft} ${noun} left.`;
}
