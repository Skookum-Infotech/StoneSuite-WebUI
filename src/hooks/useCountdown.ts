import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * Whole seconds left on a cooldown (e.g. before "Resend code" works again),
 * counting down once a second to zero. `restart` sets a new length, and 0
 * ends it at once.
 *
 * The server enforces the real cooldown; this only drives the button, so a
 * tick that drifts a few milliseconds is harmless -- an early click is simply
 * refused with a fresh `retryAfterSeconds` to restart from.
 */
export function useCountdown(initialSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, initialSeconds));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), TICK_MS);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const restart = useCallback((seconds: number) => setSecondsLeft(Math.max(0, seconds)), []);

  return { secondsLeft, restart };
}
