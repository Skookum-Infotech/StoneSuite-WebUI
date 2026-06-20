import * as React from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionExpiryModalProps {
  secondsRemaining: number;
  onStay: () => Promise<void>;
  onLogout: () => void;
  isExtending: boolean;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_SECONDS = 5 * 60;

export function SessionExpiryModal({
  secondsRemaining,
  onStay,
  onLogout,
  isExtending,
}: SessionExpiryModalProps): React.JSX.Element {
  const progress = secondsRemaining / MAX_SECONDS;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const isUrgent = secondsRemaining <= 60;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
      aria-describedby="session-expiry-desc"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">

        {/* Header row: icon + titles */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              'flex size-9 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-700',
              isUrgent ? 'bg-destructive/10' : 'bg-warning/10',
            )}
          >
            <Clock
              className={cn(
                'size-4 transition-colors duration-700',
                isUrgent ? 'text-destructive' : 'text-warning',
              )}
            />
          </div>
          <div>
            <h3 id="session-expiry-title" className="text-sm font-bold text-stone-900">
              Your session is expiring
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">You'll be signed out automatically.</p>
          </div>
        </div>

        {/* Body copy */}
        <p id="session-expiry-desc" className="text-xs text-stone-600 mb-4">
          You've been idle for a while. Stay logged in to continue, or log out now.
        </p>

        {/* Countdown ring + timer */}
        <div className="flex items-center justify-center gap-4 rounded-lg border border-stone-100 bg-stone-50 py-4 mb-5">
          <div className="relative flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 72 72" className="-rotate-90">
              <circle
                cx="36" cy="36" r={RADIUS}
                fill="none"
                stroke={isUrgent ? 'var(--color-destructive-ring)' : 'var(--color-warning-ring)'}
                strokeWidth="5"
              />
              <circle
                cx="36" cy="36" r={RADIUS}
                fill="none"
                stroke={isUrgent ? 'var(--color-destructive)' : 'var(--color-warning)'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className="motion-safe:[transition:stroke-dashoffset_1s_linear,stroke_0.7s_ease]"
              />
            </svg>
          </div>
          <span
            className={cn(
              'font-mono text-3xl font-bold tabular-nums transition-colors duration-700',
              isUrgent ? 'text-destructive' : 'text-warning',
            )}
          >
            {formatTime(secondsRemaining)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onLogout}
            disabled={isExtending}
            aria-label="Log out now"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            Log out
          </button>
          <button
            type="button"
            onClick={onStay}
            disabled={isExtending}
            aria-label="Stay logged in and extend session"
            className="flex items-center gap-1.5 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <RefreshCw
              className={cn('size-3.5', isExtending && 'animate-spin motion-reduce:animate-none')}
              aria-hidden="true"
            />
            {isExtending ? 'Extending…' : 'Stay logged in'}
          </button>
        </div>
      </div>
    </div>
  );
}
