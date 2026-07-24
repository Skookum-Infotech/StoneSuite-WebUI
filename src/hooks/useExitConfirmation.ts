import { useCallback, useEffect, useState } from 'react';

const EXIT_GUARD_KEY = 'stonesuiteExitGuard';

// React Router stamps every history entry it creates with its own stack position
// (`{ usr, key, idx }` — see createBrowserRouter's history). Index 0 is the first
// entry this SPA ever created, so a Back press from there leaves the app.
const STACK_BOTTOM_INDEX = 0;

interface ExitConfirmation {
  isPrompting: boolean;
  dismiss: () => void;
}

function historyState(): Record<string, unknown> | null {
  return window.history.state as Record<string, unknown> | null;
}

/**
 * Catches the Back press that would leave the app entirely, wherever the user
 * happens to be.
 *
 * No browser API exposes this directly: `beforeunload` does not fire on history
 * navigation, and the history stack cannot be inspected. The workaround is to
 * park one extra entry for the *current* URL at the bottom of the stack, so the
 * Back press that would have exited pops that instead and hands us a `popstate`
 * to intercept. The parked entry carries the same URL, so React Router
 * re-renders the same route and the user sees no flicker.
 *
 * Anchoring on React Router's `idx` rather than on a specific route matters: the
 * exit point is wherever the stack bottoms out — the dashboard after a login, but
 * a record page when someone opened a deep link directly.
 */
export function useExitConfirmation(enabled: boolean): ExitConfirmation {
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const arm = (): void => {
      const state = historyState();
      if (state?.[EXIT_GUARD_KEY] === true) return;
      if (state?.idx !== STACK_BOTTOM_INDEX) return;
      window.history.pushState({ ...state, [EXIT_GUARD_KEY]: true }, '');
    };
    arm();

    const onPopState = (): void => {
      // Only the pop that consumed the parked entry lands back on the stack
      // bottom without the marker. Every ordinary Back press within the app
      // lands on a higher index and must pass through untouched.
      const state = historyState();
      if (state?.idx !== STACK_BOTTOM_INDEX || state?.[EXIT_GUARD_KEY] === true) return;
      setIsPrompting(true);
      // Re-park, or the next Back press leaves with no prompt at all.
      arm();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);

  const dismiss = useCallback(() => setIsPrompting(false), []);

  return { isPrompting, dismiss };
}
