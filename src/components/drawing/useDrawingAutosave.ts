// Debounced autosave for the drawing editor (build spec §5 Task 5): saves
// 3s after the last change, Ctrl/Cmd+S saves immediately, a failed save
// retries with exponential backoff, and a 409 hands off to the caller's
// conflict handling instead of retrying (never overwrite silently).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Drawing } from '@/types/drawing';
import { DrawingConflictError, drawingService, type SaveDrawingPayload } from '@/services/drawingService';

const AUTOSAVE_DEBOUNCE_MS = 3000;
const AUTOSAVE_RETRY_BASE_MS = 2000;
const AUTOSAVE_MAX_RETRIES = 3;

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseDrawingAutosaveOptions {
  salesOrderId: string;
  present: Pick<Drawing, 'areas' | 'displayUnit' | 'fractionDenominator'>;
  recordVersion: number;
  onSaved: (drawing: Drawing) => void;
  onConflict: () => void;
  /** Suppresses the debounce from firing — e.g. while a conflict dialog or
   *  restore is already in flight, so autosave can't silently clobber the
   *  user's in-progress conflict resolution. */
  paused: boolean;
}

export function useDrawingAutosave(options: UseDrawingAutosaveOptions): { status: AutosaveStatus; saveNow: () => void } {
  const { salesOrderId, present, recordVersion, onSaved, onConflict, paused } = options;
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  // Latest values, read from inside timers/listeners that are set up once
  // and shouldn't re-subscribe on every render. Refs may only be written
  // outside render (effects/callbacks, never the render body itself), so
  // every field is mirrored in one effect that runs after every render.
  const presentRef = useRef(present);
  const recordVersionRef = useRef(recordVersion);
  const pausedRef = useRef(paused);
  const onSavedRef = useRef(onSaved);
  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    presentRef.current = present;
    recordVersionRef.current = recordVersion;
    pausedRef.current = paused;
    onSavedRef.current = onSaved;
    onConflictRef.current = onConflict;
  });

  // What the editor was opened with. Opening a drawing is not an edit: until
  // `present` actually changes from this, nothing is saved (otherwise every
  // visit to the page writes a new version, and a never-saved order gets a
  // blank drawing created just by looking at it).
  const openedWith = useRef(present);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const doSaveRef = useRef<() => void>(() => {});

  const clearPendingTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    debounceTimer.current = null;
    retryTimer.current = null;
  }, []);

  const doSave = useCallback(() => {
    if (pausedRef.current) return;
    setStatus('saving');
    const payload: SaveDrawingPayload = {
      areas: presentRef.current.areas,
      displayUnit: presentRef.current.displayUnit,
      fractionDenominator: presentRef.current.fractionDenominator,
      recordVersion: recordVersionRef.current,
    };
    drawingService
      .saveDrawing(salesOrderId, payload)
      .then((saved) => {
        retryCount.current = 0;
        setStatus('saved');
        onSavedRef.current(saved);
      })
      .catch((err: unknown) => {
        if (err instanceof DrawingConflictError) {
          setStatus('error');
          onConflictRef.current();
          return;
        }
        if (retryCount.current >= AUTOSAVE_MAX_RETRIES) {
          setStatus('error');
          return;
        }
        retryCount.current += 1;
        const delay = AUTOSAVE_RETRY_BASE_MS * 2 ** (retryCount.current - 1);
        // Via the ref, not `doSave` itself — `doSave` is still being
        // assigned at this point in its own closure.
        retryTimer.current = setTimeout(() => doSaveRef.current(), delay);
      });
  }, [salesOrderId]);

  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  const saveNow = useCallback(() => {
    clearPendingTimers();
    doSaveRef.current();
  }, [clearPendingTimers]);

  // present changed -> mark dirty now (React's own recipe for adjusting
  // state during render in response to a prop change, same pattern this
  // repo's PieceInspector uses) rather than calling setState inside an
  // effect, which would risk a cascading extra render.
  const [trackedPresent, setTrackedPresent] = useState(present);
  if (trackedPresent !== present) {
    setTrackedPresent(present);
    setStatus((s) => (s === 'saving' ? s : 'dirty'));
  }

  // Debounce: (re)start a 3s timer every time `present` changes. The timer
  // itself (a side effect on an external clock) belongs in an effect; only
  // the status change above had to move out of one.
  useEffect(() => {
    if (present === openedWith.current) return undefined;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      doSaveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [present]);

  // Ctrl/Cmd+S saves immediately, bypassing the debounce.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  // Cancel any pending debounce/retry timer on unmount.
  useEffect(() => clearPendingTimers, [clearPendingTimers]);

  return { status, saveNow };
}
