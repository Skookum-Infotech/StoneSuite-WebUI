import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { apiClient, attemptRefresh, invalidateSession, isRefreshInFlight } from '@/api/client';
import { setAuthNotice } from '@/lib/authNotice';
import { IDLE_LOGOUT_MS, IDLE_SIGNOUT_NOTICE, IDLE_WARNING_MS, idleFor, markActivity } from '@/lib/userActivity';

// How often the inactivity warning / sign-out is re-evaluated.
const IDLE_CHECK_MS = 15_000;
const MS_PER_SECOND = 1000;

/** True while the user counts as present: idle for less than the warning point. */
function userIsPresent(): boolean {
  return idleFor() < IDLE_LOGOUT_MS - IDLE_WARNING_MS;
}

// Show the warning modal this many milliseconds before the access token expires.
const WARNING_MS = 5 * 60 * 1000; // 5 minutes

// Seconds to count down inside the modal before auto-logout.
const COUNTDOWN_SECONDS = 5 * 60; // matches WARNING_MS

const SYNC_CHANNEL = 'session-sync';

// When the expiry failsafe fires while a refresh is still running (in this tab
// or another), look again this often, up to this many times, before giving up
// and logging out. Logout revokes the refresh token with no grace, so it must
// never land underneath a refresh that is about to succeed.
const FAILSAFE_RECHECK_MS = 1000;
const FAILSAFE_MAX_DEFERRALS = 15;

export interface SessionTimerState {
  showWarning: boolean;
  secondsRemaining: number;
  onStay: () => Promise<void>;
  onLogout: () => void;
  isExtending: boolean;
}

export function useSessionTimer(): SessionTimerState {
  const navigate = useNavigate();
  const { sessionExpiresAt, setSessionExpiry, logout } = useAuthStore();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(COUNTDOWN_SECONDS);
  const [isExtending, setIsExtending] = useState(false);

  // Refs to hold timers so we can clear them on re-arm.
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Why the warning is open: 'idle' closes again as soon as the user is back.
  const warningReasonRef = useRef<'idle' | 'expiry' | null>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const performLogout = useCallback(async () => {
    clearAllTimers();
    warningReasonRef.current = null;
    setShowWarning(false);
    // Await logout so the server clears cookies before we navigate. Without this,
    // a fast re-login could race against a late-arriving logout response that
    // would delete the freshly-issued auth_token cookie.
    // A customer session's cookies live at the portal endpoint; the staff one
    // would not clear them.
    const logoutPath = useAuthStore.getState().kind === 'portal' ? '/portal/auth/logout' : '/auth/logout';
    // Discard any refresh still in flight so it cannot resurrect this session.
    invalidateSession();
    await apiClient.post(logoutPath).catch(() => undefined);
    logout();
    navigate('/auth/login', { replace: true });
  }, [clearAllTimers, logout, navigate]);

  // The expiry failsafe: log out, but first let any refresh that is running
  // (here or in another tab) finish — if it succeeds the timers are re-armed
  // for the new expiry and this never logs out.
  const logoutWhenIdle = useCallback((): Promise<void> => {
    const attempt = async (deferrals: number): Promise<void> => {
      if (deferrals < FAILSAFE_MAX_DEFERRALS && (await isRefreshInFlight())) {
        expiryTimerRef.current = setTimeout(() => {
          void attempt(deferrals + 1);
        }, FAILSAFE_RECHECK_MS);
        return;
      }
      await performLogout();
    };
    return attempt(0);
  }, [performLogout]);

  // Arm (or re-arm) the warning and expiry timers whenever sessionExpiresAt changes.
  useEffect(() => {
    if (!sessionExpiresAt) return;

    const msUntilExpiry = sessionExpiresAt - Date.now();

    // Token is already expired — logout immediately (deferred to avoid setState-in-effect).
    if (msUntilExpiry <= 0) {
      setTimeout(() => performLogout(), 0);
      return;
    }

    clearAllTimers();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowWarning(false);
    warningReasonRef.current = null;

    const msUntilWarning = msUntilExpiry - WARNING_MS;

    // Near the access token's end: a user who is still using the app is
    // renewed quietly (the server is told when they were last active); only an
    // idle user sees the warning. Before this, active users got the
    // "session expiring" modal every hour.
    const nearExpiry = (secondsLeft: number) => {
      if (userIsPresent()) {
        void attemptRefresh().then((outcome) => {
          if (outcome === 'rejected') void performLogout();
        });
        return;
      }
      warningReasonRef.current = 'expiry';
      setSecondsRemaining(secondsLeft);
      setShowWarning(true);
      startCountdown();
    };
    if (msUntilWarning > 0) {
      // Token has more than 5 min left — schedule the check.
      warningTimerRef.current = setTimeout(() => nearExpiry(COUNTDOWN_SECONDS), msUntilWarning);
    } else {
      // Less than 5 min already left — check now.
      nearExpiry(Math.floor(msUntilExpiry / 1000));
    }

    // Failsafe: hard-logout when the token actually expires.
    expiryTimerRef.current = setTimeout(() => {
      void logoutWhenIdle();
    }, msUntilExpiry);

    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpiresAt]);

  // Inactivity: warn 5 minutes before IDLE_LOGOUT_MS without any input in any
  // tab, and sign out at IDLE_LOGOUT_MS -- whatever background requests ran
  // meanwhile. Input while the warning is up (or "Stay logged in") clears it.
  useEffect(() => {
    if (!sessionExpiresAt) return undefined;
    const check = () => {
      const idle = idleFor();
      if (idle >= IDLE_LOGOUT_MS) {
        setAuthNotice(IDLE_SIGNOUT_NOTICE);
        try {
          const ch = new BroadcastChannel(SYNC_CHANNEL);
          ch.postMessage({ type: 'SESSION_LOGOUT' });
          ch.close();
        } catch { /* ignore */ }
        void performLogout();
      } else if (idle >= IDLE_LOGOUT_MS - IDLE_WARNING_MS) {
        if (warningReasonRef.current === null) {
          warningReasonRef.current = 'idle';
          setSecondsRemaining(Math.ceil((IDLE_LOGOUT_MS - idle) / MS_PER_SECOND));
          setShowWarning(true);
          startCountdown();
        }
      } else if (warningReasonRef.current === 'idle') {
        warningReasonRef.current = null;
        setShowWarning(false);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      }
    };
    check();
    const timer = setInterval(check, IDLE_CHECK_MS);
    return () => clearInterval(timer);
  }, [sessionExpiresAt, performLogout, startCountdown]);

  // Listen for events from other tabs via BroadcastChannel.
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(SYNC_CHANNEL);
      ch.onmessage = (e: MessageEvent<{ type: string; expiresAt?: number }>) => {
        if (e.data.type === 'SESSION_EXTENDED' && e.data.expiresAt) {
          // Another tab extended the session — update our expiry and hide the warning.
          setSessionExpiry(e.data.expiresAt);
          setShowWarning(false);
          warningReasonRef.current = null;
          clearAllTimers();
        } else if (e.data.type === 'SESSION_EXPIRED' || e.data.type === 'SESSION_LOGOUT') {
          performLogout();
        }
      };
    } catch {
      // BroadcastChannel not available in this environment — skip silently.
    }
    return () => ch?.close();
  }, [clearAllTimers, performLogout, setSessionExpiry]);

  const onStay = useCallback(async () => {
    // Choosing to stay is activity: the refresh below reports it to the server.
    markActivity(Date.now(), true);
    warningReasonRef.current = null;
    setIsExtending(true);
    // Stand the hard-logout failsafe down while the refresh is in flight. Left
    // armed, it can fire mid-request (the refresh can take seconds on a cold
    // start) and POST /auth/logout, which revokes the refresh token with no
    // grace — the refresh that follows is then refused as "reused" and the user
    // who just clicked Stay is signed out.
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    try {
      // The same refresh the 401 interceptor uses. It stores the new access token
      // and expiry, tells other tabs, re-sends the selected role, retries a cold
      // start, and refreshes a customer-portal session at its own endpoint — a
      // bare POST /auth/refresh did none of that (and always failed for portal
      // sessions, whose refresh cookie is scoped to /api/portal/auth).
      const outcome = await attemptRefresh();
      if (outcome === 'ok') {
        setShowWarning(false);
        warningReasonRef.current = null;
      } else if (outcome === 'rejected') {
        // Only an explicit refusal ends the session.
        await performLogout();
      }
      // 'transient': the backend was unreachable — keep the warning open so the
      // user can press Stay signed in again instead of being signed out. Put the
      // failsafe back for whatever time is left; if the access token has already
      // run out meanwhile, leave the modal up rather than logging out a session
      // whose refresh token may still be good.
      if (outcome === 'transient') {
        const msLeft = (useAuthStore.getState().sessionExpiresAt ?? 0) - Date.now();
        if (msLeft > 0) {
          expiryTimerRef.current = setTimeout(() => {
            void logoutWhenIdle();
          }, msLeft);
        }
      }
    } finally {
      setIsExtending(false);
    }
  }, [performLogout, logoutWhenIdle]);

  const onLogout = useCallback(() => {
    try {
      const ch = new BroadcastChannel(SYNC_CHANNEL);
      ch.postMessage({ type: 'SESSION_LOGOUT' });
      ch.close();
    } catch { /* ignore */ }
    performLogout();
  }, [performLogout]);

  return { showWarning, secondsRemaining, onStay, onLogout, isExtending };
}
