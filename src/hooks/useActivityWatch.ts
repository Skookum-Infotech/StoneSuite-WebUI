import { useEffect } from 'react';
import { focusManager } from '@tanstack/react-query';
import { ACTIVITY_EVENTS, IDLE_PAUSE_MS, idleFor, markActivity } from '@/lib/userActivity';

/** How often idleness is re-evaluated. */
const IDLE_CHECK_MS = 15_000;

/**
 * Records the user's activity and pauses every polling query while they are
 * idle. After IDLE_PAUSE_MS without input in any tab, TanStack Query is told
 * the app is unfocused, which stops every refetchInterval (none of them poll
 * in the background), so an open but unused window stops calling the backend
 * and the scale-to-zero backend and database can sleep. The first input hands
 * focus back to the browser's own visibility state, and stale queries
 * (the session check among them) refetch at once.
 */
export function useActivityWatch(): void {
  useEffect(() => {
    let paused = false;
    const resume = () => {
      if (!paused) return;
      paused = false;
      focusManager.setFocused(undefined);
    };
    const onInput = () => {
      markActivity();
      resume();
    };
    const check = () => {
      if (!paused && idleFor() >= IDLE_PAUSE_MS) {
        paused = true;
        focusManager.setFocused(false);
      } else if (paused && idleFor() < IDLE_PAUSE_MS) {
        resume(); // another tab of this browser saw activity
      }
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onInput, { passive: true, capture: true });
    }
    const timer = setInterval(check, IDLE_CHECK_MS);
    return () => {
      clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onInput, { capture: true });
      }
      resume();
    };
  }, []);
}
