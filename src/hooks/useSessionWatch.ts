import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { SESSION_REPLACED_MESSAGE, forceLogout, reportSessionReplaced } from '@/api/client';
import type { ReplacedSessionInfo, SessionStatusResponse } from '@/types/auth';

/**
 * How often a visible signed-in tab asks whether its session is still the
 * live one. Hidden tabs do not ask at all (they check again the moment they
 * are shown), so an open but unused browser never keeps the scale-to-zero
 * backend and database awake. Any normal API call also finds out at once.
 */
export const SESSION_POLL_MS = 30_000;

const SYNC_CHANNEL = 'session-sync';

/** What a GET /auth/session answer means for this tab. */
export type SessionWatchAction =
  | { kind: 'none' }
  | { kind: 'replaced'; info: ReplacedSessionInfo }
  | { kind: 'logout' };

/**
 * Maps a session status to what the tab must do. `now` is this browser's
 * clock at the moment the answer arrived: the end of the handover is
 * re-anchored to it from the server's relative `endsInMs`, so a computer
 * whose clock is wrong still gets the full countdown.
 */
export function sessionWatchAction(res: SessionStatusResponse, now: number): SessionWatchAction {
  if (res.status === 'active') return { kind: 'none' };
  // Replaced by another sign-in (still in its handover, or past it): the
  // countdown overlay explains it. Ended with no replacement: a plain logout
  // (e.g. from another tab) — sign out now.
  if (res.status === 'replacing' || res.replacedBy) {
    const endsAt = res.endsInMs !== undefined ? now + res.endsInMs : undefined;
    return { kind: 'replaced', info: { deviceLabel: res.replacedBy?.deviceLabel, endsAt } };
  }
  return { kind: 'logout' };
}

/**
 * Watches for this staff session being taken over by a sign-in on another
 * browser: polls GET /auth/session (also on focus/reconnect) and listens for
 * another tab of this browser finding out first. Either way it records the
 * takeover in useAuthStore, which shows SessionReplacedOverlay.
 */
export function useSessionWatch(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPortal = useAuthStore((s) => s.kind === 'portal');
  const replaced = useAuthStore((s) => s.replacedSession !== null);
  const enabled = isAuthenticated && !isPortal && !replaced;

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ['auth', 'session-status'],
    queryFn: authService.getSessionStatus,
    enabled,
    refetchInterval: SESSION_POLL_MS,
    // Hidden tabs stay quiet; focus/visibility triggers a check on return.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data || !enabled) return;
    const action = sessionWatchAction(data, dataUpdatedAt);
    if (action.kind === 'replaced') reportSessionReplaced(action.info);
    else if (action.kind === 'logout') forceLogout();
  }, [data, dataUpdatedAt, enabled]);

  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(SYNC_CHANNEL);
      ch.addEventListener('message', (e: MessageEvent<{ type: string; info?: ReplacedSessionInfo }>) => {
        if (e.data.type === SESSION_REPLACED_MESSAGE) reportSessionReplaced(e.data.info ?? {}, false);
      });
    } catch {
      // BroadcastChannel not available — this tab's own poll still finds out.
    }
    return () => ch?.close();
  }, []);
}
