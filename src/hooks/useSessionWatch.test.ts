import { describe, it, expect } from 'vitest';
import { sessionWatchAction } from './useSessionWatch';
import type { SessionStatusResponse } from '@/types/auth';

describe('sessionWatchAction', () => {
  const by = { at: 1, deviceLabel: 'Edge on Windows' };
  const now = 1_000_000;
  it.each<[string, SessionStatusResponse, ReturnType<typeof sessionWatchAction>]>([
    ['live session: nothing to do', { success: true, status: 'active' }, { kind: 'none' }],
    ['in the handover: countdown anchored to this clock',
      { success: true, status: 'replacing', endsAt: 99, endsInMs: 40_000, replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: now + 40_000 } }],
    ['the server end time is never used directly (a wrong PC clock)',
      { success: true, status: 'replacing', endsAt: now - 3_600_000, endsInMs: 60_000, replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: now + 60_000 } }],
    ['past the handover: still the countdown', { success: true, status: 'ended', endsInMs: 0, replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: now } }],
    ['no relative end: the default countdown', { success: true, status: 'replacing', replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: undefined } }],
    ['logged out elsewhere: sign out', { success: true, status: 'ended' }, { kind: 'logout' }],
  ])('%s', (_name, res, want) => {
    expect(sessionWatchAction(res, now)).toEqual(want);
  });
});
