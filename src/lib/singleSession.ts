import { isAxiosError } from 'axios';
import type { ActiveSessionPrompt } from '@/types/auth';

// One live session per licensed user (backend: controllers/session_gate.go).
// A sign-in while the account is in use elsewhere answers 409 with this code;
// the takeover ticket rides along as an HttpOnly cookie this code never sees.
// Requests from a session another sign-in took over
// answer 409 (writes during the handover) or 401 with SESSION_REPLACED_CODE.
export const ACTIVE_SESSION_CODE = 'active_session';
export const SESSION_REPLACED_CODE = 'session_replaced';
export const TAKEOVER_EXPIRED_CODE = 'takeover_expired';

/** Moving the sign-in to this browser was refused by the workspace's limits:
 *  the wait between device switches, or the daily number of switches. The
 *  server's message says which, and when to try again. */
export const TAKEOVER_REFUSED_CODES: readonly string[] = ['takeover_cooldown', 'takeover_limit'];

/** How long the replaced browser's overlay counts down before signing out. */
export const SESSION_REPLACED_COUNTDOWN_SECONDS = 30;

/** Shown on the login page the replaced browser lands on. */
export const SESSION_REPLACED_NOTICE =
  'You were signed out because your account was signed in on another computer.';

const HTTP_CONFLICT = 409;
const MS_PER_SECOND = 1000;

function bodyCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' ? code : null;
}

/** True when an API error body says this session was replaced by another sign-in. */
export function isSessionReplacedBody(body: unknown): boolean {
  return bodyCode(body) === SESSION_REPLACED_CODE;
}

/** True when an axios error is the backend refusing a replaced session. */
export function isSessionReplacedError(err: unknown): boolean {
  return isAxiosError(err) && isSessionReplacedBody(err.response?.data);
}

/** The "already signed in elsewhere" prompt a sign-in error carries, or null. */
export function activeSessionPrompt(err: unknown): ActiveSessionPrompt | null {
  if (!isAxiosError(err) || err.response?.status !== HTTP_CONFLICT) return null;
  const body = err.response.data as {
    code?: unknown;
    activeSession?: { deviceLabel?: unknown; lastSeenAt?: unknown };
  };
  if (bodyCode(body) !== ACTIVE_SESSION_CODE) return null;
  const deviceLabel = body.activeSession?.deviceLabel;
  const lastSeenAt = body.activeSession?.lastSeenAt;
  return {
    deviceLabel: typeof deviceLabel === 'string' && deviceLabel !== '' ? deviceLabel : 'another device',
    lastSeenAt: typeof lastSeenAt === 'number' ? lastSeenAt : null,
  };
}

/**
 * Seconds the overlay starts counting down from: the full countdown, but never
 * past the server's own end of the handover (endsAt, unix ms) when known.
 */
export function initialCountdownSeconds(endsAt: number | undefined, now: number): number {
  if (endsAt === undefined) return SESSION_REPLACED_COUNTDOWN_SECONDS;
  const left = Math.ceil((endsAt - now) / MS_PER_SECOND);
  return Math.max(0, Math.min(SESSION_REPLACED_COUNTDOWN_SECONDS, left));
}

const SECONDS_PER_MINUTE = 60;

/** "0:30" — minutes without padding, seconds padded. */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const s = totalSeconds % SECONDS_PER_MINUTE;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const MINUTE_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const HOUR_MS = 60 * MINUTE_MS;

/** "just now", "5 minutes ago", "2 hours ago" for the takeover prompt. */
export function lastActiveLabel(lastSeenAt: number | null, now: number): string {
  if (lastSeenAt === null) return 'recently';
  const ago = Math.max(0, now - lastSeenAt);
  if (ago < MINUTE_MS) return 'just now';
  if (ago < HOUR_MS) {
    const m = Math.floor(ago / MINUTE_MS);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  const h = Math.floor(ago / HOUR_MS);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
