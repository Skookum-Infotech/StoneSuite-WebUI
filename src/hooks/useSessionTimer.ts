import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { apiClient } from '@/api/client';

// Show the warning modal this many milliseconds before the access token expires.
const WARNING_MS = 5 * 60 * 1000; // 5 minutes

// Seconds to count down inside the modal before auto-logout.
const COUNTDOWN_SECONDS = 5 * 60; // matches WARNING_MS

const SYNC_CHANNEL = 'session-sync';

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

  const performLogout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    apiClient.post('/auth/logout').catch(() => undefined);
    logout();
    navigate('/auth/login', { replace: true });
  }, [clearAllTimers, logout, navigate]);

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

    const msUntilWarning = msUntilExpiry - WARNING_MS;

    if (msUntilWarning > 0) {
      // Token has more than 5 min left — schedule the warning.
      warningTimerRef.current = setTimeout(() => {
        setSecondsRemaining(COUNTDOWN_SECONDS);
        setShowWarning(true);
        startCountdown();
      }, msUntilWarning);
    } else {
      // Less than 5 min already left — show warning immediately.
      const remaining = Math.floor(msUntilExpiry / 1000);
      setSecondsRemaining(remaining);
      setShowWarning(true);
      startCountdown();
    }

    // Failsafe: hard-logout when the token actually expires.
    expiryTimerRef.current = setTimeout(() => {
      performLogout();
    }, msUntilExpiry);

    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpiresAt]);

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
    setIsExtending(true);
    try {
      const res = await authService.refreshSession();
      if (res.success && res.expiresAt) {
        setSessionExpiry(res.expiresAt);
        setShowWarning(false);
        // Notify other tabs.
        try {
          const ch = new BroadcastChannel(SYNC_CHANNEL);
          ch.postMessage({ type: 'SESSION_EXTENDED', expiresAt: res.expiresAt });
          ch.close();
        } catch { /* ignore */ }
      } else {
        // Refresh failed — both tokens expired. Logout.
        performLogout();
      }
    } catch {
      performLogout();
    } finally {
      setIsExtending(false);
    }
  }, [performLogout, setSessionExpiry]);

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
