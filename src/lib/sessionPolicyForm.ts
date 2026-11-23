// The two number settings of a customer's session policy (Settings tab):
// the wait between device switches and the daily number of switches.

/** Defaults applied by the backend when a customer has never been changed. */
export const DEFAULT_TAKEOVER_COOLDOWN_MINUTES = 5;
export const DEFAULT_TAKEOVER_DAILY_CAP = 5;

/** Upper bounds (mirrored by the backend and the database). 0 = off. */
export const MAX_TAKEOVER_COOLDOWN_MINUTES = 1440;
export const MAX_TAKEOVER_DAILY_CAP = 100;

/**
 * Parses a number box: a whole number from 0 to max, or an error message.
 * Empty, decimals, negatives and values over max are refused.
 */
export function parseLimit(raw: string, max: number): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (text === '') return { value: null, error: 'Enter a number (0 turns it off).' };
  if (!/^\d+$/.test(text)) return { value: null, error: 'Enter a whole number, 0 or more.' };
  const value = Number(text);
  if (value > max) return { value: null, error: `Must be ${max} or less.` };
  return { value, error: null };
}

export interface SessionPolicyPatch {
  enforced?: boolean;
  takeoverCooldownMinutes?: number;
  takeoverDailyCap?: number;
}

/** The fields of the two boxes that differ from what is saved — only these are sent. */
export function changedLimits(
  saved: { cooldown: number; cap: number },
  edited: { cooldown: number | null; cap: number | null },
): SessionPolicyPatch {
  const patch: SessionPolicyPatch = {};
  if (edited.cooldown !== null && edited.cooldown !== saved.cooldown) patch.takeoverCooldownMinutes = edited.cooldown;
  if (edited.cap !== null && edited.cap !== saved.cap) patch.takeoverDailyCap = edited.cap;
  return patch;
}
