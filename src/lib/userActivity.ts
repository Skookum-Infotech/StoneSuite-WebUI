// When the user last actually used the app (mouse, keyboard, scroll, touch),
// shared by every tab of this browser. Background requests and polling never
// count. Drives: pausing all polling after IDLE_PAUSE_MS, the inactivity
// warning and sign-out (useSessionTimer), refusing to renew an idle session
// (api/client.ts), and the lastActiveAt the server checks on every refresh.

/** No input for this long: background polling pauses until the next input. */
export const IDLE_PAUSE_MS = 5 * 60 * 1000;
/** No input for this long: signed out. Must match the backend's SESSION_IDLE_TIMEOUT. */
export const IDLE_LOGOUT_MS = 60 * 60 * 1000;
/** The inactivity warning shows this long before the idle sign-out. */
export const IDLE_WARNING_MS = 5 * 60 * 1000;

/** Shown on the login page after an inactivity sign-out. */
export const IDLE_SIGNOUT_NOTICE = 'You were signed out after 60 minutes of inactivity.';

/** Activity is written at most this often (mousemove fires constantly). */
const WRITE_THROTTLE_MS = 5000;
const STORAGE_KEY = 'stonesuite-last-activity';

let lastActivity = Date.now();
let lastWrite = 0;

function readShared(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

/**
 * Records user activity at `now`. Throttled; `force` writes at once (sign-in).
 * Other tabs see it through localStorage.
 */
export function markActivity(now = Date.now(), force = false): void {
  if (now > lastActivity) lastActivity = now;
  if (!force && now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(STORAGE_KEY, String(lastActivity));
  } catch {
    // Storage blocked: this tab still tracks its own activity.
  }
}

/** The latest activity seen in any tab of this browser (unix ms). */
export function getLastActivity(): number {
  return Math.max(lastActivity, readShared());
}

/** Milliseconds since the user last used the app in any tab. */
export function idleFor(now = Date.now()): number {
  return Math.max(0, now - getLastActivity());
}

/** For tests: forget everything recorded. */
export function resetActivityForTests(at = Date.now()): void {
  lastActivity = at;
  lastWrite = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Input events that mean someone is using the app. */
export const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
