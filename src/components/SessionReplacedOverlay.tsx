import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { forceLogout } from '@/api/client';
import { useCountdown } from '@/hooks/useCountdown';
import {
  SESSION_REPLACED_COUNTDOWN_SECONDS,
  SESSION_REPLACED_NOTICE,
  formatCountdown,
  initialCountdownSeconds,
} from '@/lib/singleSession';
import type { ReplacedSessionInfo } from '@/types/auth';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface SessionReplacedOverlayProps {
  info: ReplacedSessionInfo;
}

/**
 * Full-screen, blocking notice shown when this account signed in on another
 * computer: the app underneath can no longer be used (the server refuses its
 * writes too), and after a 30-second countdown this browser signs out and
 * returns to the sign-in page.
 */
export function SessionReplacedOverlay({ info }: SessionReplacedOverlayProps): React.JSX.Element {
  const [start] = useState(() => initialCountdownSeconds(info.endsAt, Date.now()));
  const { secondsLeft } = useCountdown(start);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const signedOut = useRef(false);

  const signOut = React.useCallback(() => {
    if (signedOut.current) return;
    signedOut.current = true;
    // Unsaved-changes guards would otherwise stop the redirect with a "Leave
    // site?" prompt; nothing here can be saved any more, so skip them. Capture
    // listeners on window run first, and this one stops the rest.
    window.addEventListener('beforeunload', (e) => e.stopImmediatePropagation(), { capture: true });
    forceLogout(SESSION_REPLACED_NOTICE, { awaitServer: true });
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) signOut();
  }, [secondsLeft, signOut]);

  // Keep focus inside the dialog: the page underneath must not be reachable
  // by keyboard while it is covered.
  useEffect(() => {
    logoutRef.current?.focus();
    const keepFocus = (e: FocusEvent) => {
      if (logoutRef.current && e.target !== logoutRef.current) logoutRef.current.focus();
    };
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Tab' && document.activeElement === logoutRef.current)) {
        e.preventDefault();
      }
    };
    document.addEventListener('focusin', keepFocus);
    document.addEventListener('keydown', blockKeys, true);
    return () => {
      document.removeEventListener('focusin', keepFocus);
      document.removeEventListener('keydown', blockKeys, true);
    };
  }, []);

  const dashOffset = CIRCUMFERENCE * (1 - secondsLeft / SESSION_REPLACED_COUNTDOWN_SECONDS);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-950/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-replaced-title"
      aria-describedby="session-replaced-desc"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <MonitorSmartphone className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <h3 id="session-replaced-title" className="text-sm font-bold text-stone-900">
            Signed in on another computer
          </h3>
        </div>

        <p id="session-replaced-desc" className="mb-4 text-xs text-stone-600">
          Your account was signed in on another computer
          {info.deviceLabel ? ` (${info.deviceLabel})` : ''}. This session will end in{' '}
          <span className="font-semibold text-stone-900">{formatCountdown(secondsLeft)}</span>.
          Changes can no longer be saved here.
        </p>

        <div className="mb-5 flex items-center justify-center gap-4 rounded-lg border border-stone-100 bg-stone-50 py-4">
          <svg width="56" height="56" viewBox="0 0 72 72" className="-rotate-90" aria-hidden="true">
            <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--color-destructive-ring)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r={RADIUS}
              fill="none"
              stroke="var(--color-destructive)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="motion-safe:[transition:stroke-dashoffset_1s_linear]"
            />
          </svg>
          <span
            className="font-mono text-3xl font-bold tabular-nums text-destructive"
            role="timer"
            aria-live="polite"
            aria-label={`Signing out in ${secondsLeft} seconds`}
          >
            {formatCountdown(secondsLeft)}
          </span>
        </div>

        <div className="flex justify-end">
          <button
            ref={logoutRef}
            type="button"
            onClick={signOut}
            aria-label="Log out now"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
