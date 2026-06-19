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

// Progress ring dimensions.
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
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
      aria-describedby="session-expiry-desc"
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={cn(
          'relative z-10 w-full max-w-sm mx-4 rounded-2xl border shadow-2xl overflow-hidden',
          'bg-[#0f1923] border-white/[0.08]',
          'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        {/* Top accent bar — turns red when urgent */}
        <div
          className={cn(
            'h-0.5 w-full transition-colors duration-1000',
            isUrgent ? 'bg-red-500' : 'bg-amber-500',
          )}
        />

        <div className="px-6 pt-6 pb-7 flex flex-col items-center gap-5 text-center">

          {/* Countdown ring */}
          <div className="relative flex items-center justify-center">
            <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
              {/* Track */}
              <circle
                cx="36" cy="36" r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="4"
              />
              {/* Progress arc */}
              <circle
                cx="36" cy="36" r={RADIUS}
                fill="none"
                stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s ease' }}
              />
            </svg>
            {/* Icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock
                className={cn(
                  'size-6 transition-colors duration-1000',
                  isUrgent ? 'text-red-400' : 'text-amber-400',
                )}
              />
            </div>
          </div>

          {/* Countdown time */}
          <span
            className={cn(
              'font-mono text-3xl font-bold tracking-widest tabular-nums transition-colors duration-1000',
              isUrgent ? 'text-red-400' : 'text-amber-300',
            )}
          >
            {formatTime(secondsRemaining)}
          </span>

          {/* Heading + description */}
          <div className="space-y-1.5">
            <h2 id="session-expiry-title" className="text-base font-bold text-white">
              Your session is expiring
            </h2>
            <p id="session-expiry-desc" className="text-sm text-stone-400 leading-relaxed">
              You've been idle for a while. Stay logged in to continue,
              or we'll sign you out automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-2 pt-1">
            <button
              onClick={onStay}
              disabled={isExtending}
              className={cn(
                'relative w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                'text-sm font-bold text-stone-950 transition-all duration-150',
                'bg-amber-400 hover:bg-amber-300 active:scale-[0.98]',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1923]',
              )}
              aria-label="Stay logged in and extend session"
            >
              {isExtending ? (
                <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {isExtending ? 'Extending session…' : 'Stay logged in'}
            </button>

            <button
              onClick={onLogout}
              disabled={isExtending}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                'text-sm font-semibold text-stone-400 hover:text-white transition-colors duration-150',
                'hover:bg-white/[0.06] active:scale-[0.98]',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1923]',
              )}
              aria-label="Log out now"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Log out now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
