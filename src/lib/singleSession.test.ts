import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import {
  SESSION_REPLACED_COUNTDOWN_SECONDS,
  activeSessionPrompt,
  formatCountdown,
  initialCountdownSeconds,
  isSessionReplacedBody,
  lastActiveLabel,
} from './singleSession';

function apiError(status: number, data: unknown) {
  return new AxiosError('fail', undefined, undefined, undefined, { status, data } as never);
}

describe('activeSessionPrompt', () => {
  it.each([
    ['a full prompt', apiError(409, { code: 'active_session', activeSession: { deviceLabel: 'Chrome on Windows', lastSeenAt: 5 } }),
      { deviceLabel: 'Chrome on Windows', lastSeenAt: 5 }],
    ['missing details fall back', apiError(409, { code: 'active_session' }), { deviceLabel: 'another device', lastSeenAt: null }],
    ['another 409', apiError(409, { code: 'conflict' }), null],
    ['active_session with another status', apiError(400, { code: 'active_session' }), null],
    ['not an axios error', new Error('x'), null],
  ])('%s', (_name, err, want) => {
    expect(activeSessionPrompt(err)).toEqual(want);
  });
});

describe('isSessionReplacedBody', () => {
  it.each([
    [{ code: 'session_replaced' }, true],
    [{ code: 'workspace_suspended' }, false],
    [{}, false],
    [null, false],
    ['session_replaced', false],
  ])('%j -> %s', (body, want) => {
    expect(isSessionReplacedBody(body)).toBe(want);
  });
});

describe('initialCountdownSeconds', () => {
  const now = 1_000_000;
  it.each([
    ['no server end: the full countdown', undefined, SESSION_REPLACED_COUNTDOWN_SECONDS],
    ['server end further away: capped at the countdown', now + 45_000, SESSION_REPLACED_COUNTDOWN_SECONDS],
    ['server end sooner: follows it', now + 12_400, 13],
    ['server end passed: zero', now - 1, 0],
  ])('%s', (_name, endsAt, want) => {
    expect(initialCountdownSeconds(endsAt, now)).toBe(want);
  });
});

describe('formatCountdown', () => {
  it.each([[30, '0:30'], [9, '0:09'], [0, '0:00'], [75, '1:15']])('%i -> %s', (secs, want) => {
    expect(formatCountdown(secs)).toBe(want);
  });
});

describe('lastActiveLabel', () => {
  const now = 10 * 60 * 60 * 1000;
  it.each([
    [null, 'recently'],
    [now - 10_000, 'just now'],
    [now - 60_000, '1 minute ago'],
    [now - 5 * 60_000, '5 minutes ago'],
    [now - 60 * 60_000, '1 hour ago'],
    [now - 3 * 60 * 60_000, '3 hours ago'],
    [now + 5000, 'just now'],
  ])('%s -> %s', (lastSeenAt, want) => {
    expect(lastActiveLabel(lastSeenAt, now)).toBe(want);
  });
});
