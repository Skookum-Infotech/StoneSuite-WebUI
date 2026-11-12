import { describe, it, expect } from 'vitest';
import { sessionWatchAction } from './useSessionWatch';
import type { SessionStatusResponse } from '@/types/auth';

describe('sessionWatchAction', () => {
  const by = { at: 1, deviceLabel: 'Edge on Windows' };
  it.each<[string, SessionStatusResponse, ReturnType<typeof sessionWatchAction>]>([
    ['live session: nothing to do', { success: true, status: 'active' }, { kind: 'none' }],
    ['in the handover: countdown', { success: true, status: 'replacing', endsAt: 99, replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: 99 } }],
    ['past the handover: still the countdown', { success: true, status: 'ended', endsAt: 99, replacedBy: by },
      { kind: 'replaced', info: { deviceLabel: 'Edge on Windows', endsAt: 99 } }],
    ['logged out elsewhere: sign out', { success: true, status: 'ended' }, { kind: 'logout' }],
  ])('%s', (_name, res, want) => {
    expect(sessionWatchAction(res)).toEqual(want);
  });
});
