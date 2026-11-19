// Leaving the drawing editor for the sales order it belongs to. Edits waiting for their autosave
// are saved first and the editor only closes once that has landed, so an Exit never throws away
// work; if the save fails the editor stays open on its "Retry save" button.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AutosaveStatus } from './useDrawingAutosave';

const UNSAVED: ReadonlySet<AutosaveStatus> = new Set(['dirty', 'saving', 'error']);

export function useExitDrawing(salesOrderId: string, status: AutosaveStatus, saveNow: () => void): () => void {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  // A failed save cancels the exit (React's recipe for adjusting state while rendering), so
  // a later successful retry does not suddenly carry the user away.
  if (leaving && status === 'error') setLeaving(false);

  useEffect(() => {
    if (leaving && (status === 'idle' || status === 'saved')) navigate(`/sales/sales_order/${salesOrderId}`);
  }, [leaving, status, navigate, salesOrderId]);

  return useCallback(() => {
    if (!UNSAVED.has(status)) {
      navigate(`/sales/sales_order/${salesOrderId}`);
      return;
    }
    // Already saving: just wait for it. Otherwise ask for the save now.
    if (status !== 'saving') saveNow();
    setLeaving(true);
  }, [status, saveNow, navigate, salesOrderId]);
}
