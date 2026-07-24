import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';

export interface UnsavedChangesGuard {
  /** True while an in-app navigation is paused waiting on the user's answer. */
  isPrompting: boolean;
  /** Abandon the edits and continue to the blocked destination. */
  confirmLeave: () => void;
  /** Stay on the page and cancel the pending navigation. */
  cancelLeave: () => void;
  /** Call before a post-save navigate so the guard stays out of the way. */
  markClean: () => void;
}

/**
 * Warns before in-progress form edits are lost.
 *
 * `useBlocker` covers every in-app route change — sidebar links, Cancel buttons
 * and, critically, the browser Back button. `beforeunload` covers leaving the
 * document entirely (tab close, reload, external link); browsers render their
 * own fixed confirmation there, so that wording is not ours to choose.
 *
 * Dirtiness is a JSON comparison against the first snapshot committed once
 * `isReady` turns true, which lets edit pages baseline against the loaded record
 * rather than against empty defaults.
 *
 * Dirtiness lives in refs rather than state deliberately: nothing in this hook
 * renders from it. Both consumers — the blocker predicate and the unload
 * listener — run outside render, and keeping them ref-driven lets the predicate
 * stay referentially stable, where re-registering it on every keystroke would
 * drop the pending block. The only rendered value, `isPrompting`, comes from
 * React Router's own blocker state.
 */
export function useUnsavedChangesGuard(snapshot: unknown, isReady = true): UnsavedChangesGuard {
  const serialized = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  const baselineRef = useRef<string | undefined>(undefined);
  const isDirtyRef = useRef(false);
  const bypassRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (baselineRef.current === undefined) baselineRef.current = serialized;
    isDirtyRef.current = baselineRef.current !== serialized;
  }, [isReady, serialized]);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      isDirtyRef.current && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname,
    [],
  );
  const blocker = useBlocker(shouldBlock);

  // Registered once and gated from inside, so the listener never churns as the
  // form is typed into.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent): void => {
      if (isDirtyRef.current && !bypassRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const confirmLeave = useCallback(() => {
    bypassRef.current = true;
    blocker.proceed?.();
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);

  // A ref, not state: the post-save navigate fires in the same tick as the save
  // callback, before a re-render could apply a state flag.
  const markClean = useCallback(() => {
    bypassRef.current = true;
  }, []);

  return {
    isPrompting: blocker.state === 'blocked',
    confirmLeave,
    cancelLeave,
    markClean,
  };
}
