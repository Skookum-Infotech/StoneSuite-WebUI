import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { SESSION_REPLACED_MESSAGE, forceLogout, reportSessionReplaced } from '@/api/client';
import type { ReplacedSessionInfo, SessionStatusResponse } from '@/types/auth';

/** How often a signed-in tab asks whether its session is still the live one. */
export const SESSION_POLL_MS = 10_000;

const SYNC_CHANNEL = 'session-sync';

/** What a GET /auth/session answer means for this tab. */
export type SessionWatchAction =
  | { kind: 'none' }
  | { kind: 'replaced'; info: ReplacedSessionInfo }
  | { kind: 'logout' };

/** Maps a session status to what the tab must do. */
export function sessionWatchAction(res: SessionStatusResponse): SessionWatchAction {
  if (res.status === 'active') return { kind: 'none' };
  // Replaced by another sign-in (still in its handover, or past it): the
  // countdown overlay explains it. Ended with no replacement: a plain logout
  // (e.g. from another tab) — sign out now.
  if (res.status === 'replacing' || res.replacedBy) {
    return { kind: 'replaced', info: { deviceLabel: res.replacedBy?.deviceLabel, endsAt: res.endsAt } };
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

  const { data } = useQuery({
    queryKey: ['auth', 'session-status'],
    queryFn: authService.getSessionStatus,
    enabled,
    refetchInterval: SESSION_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!data || !enabled) return;
    const action = sessionWatchAction(data);
    if (action.kind === 'replaced') reportSessionReplaced(action.info);
    else if (action.kind === 'logout') forceLogout();
  }, [data, enabled]);

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
