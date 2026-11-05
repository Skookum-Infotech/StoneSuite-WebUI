// Top toolbar: undo/redo, zoom, version history and the save status. The tools
// that add pieces and cutouts live in the left panel (ShapePalette,
// CutoutLibrary).

import { useState } from 'react';
import { ZOOM_STEP } from '@/lib/drawing/constants';
import type { Drawing } from '@/types/drawing';
import type { AutosaveStatus } from './useDrawingAutosave';
import { VersionDrawer } from './VersionDrawer';
import { useDrawingEditor } from './DrawingEditorContext';

const SAVE_STATUS_LABEL: Record<AutosaveStatus, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const BUTTON_CLASS = 'rounded border border-stone-200 px-2 py-1 text-xs disabled:opacity-40';

export function DrawingToolbar({ saveStatus }: { saveStatus: AutosaveStatus }) {
  const { state, dispatch, fitToArea } = useDrawingEditor();
  const [showVersions, setShowVersions] = useState(false);

  const restoreVersion = (restored: Drawing) => {
    dispatch({ type: 'loadDrawing', drawing: restored });
    setShowVersions(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Undo" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })} className={BUTTON_CLASS}>
        Undo
      </button>
      <button type="button" aria-label="Redo" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })} className={BUTTON_CLASS}>
        Redo
      </button>

      <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

      <button type="button" aria-label="Zoom out" onClick={() => dispatch({ type: 'setZoom', zoom: state.zoom - ZOOM_STEP })} className={BUTTON_CLASS}>
        −
      </button>
      <span className="w-10 text-center text-2xs text-stone-500" aria-label="Zoom level">{Math.round(state.zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" onClick={() => dispatch({ type: 'setZoom', zoom: state.zoom + ZOOM_STEP })} className={BUTTON_CLASS}>
        +
      </button>
      <button type="button" aria-label="Fit area" onClick={fitToArea} className={BUTTON_CLASS}>
        Fit
      </button>

      <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

      <button type="button" onClick={() => setShowVersions(true)} className={BUTTON_CLASS}>
        Version history
      </button>
      {saveStatus !== 'idle' && (
        <span role="status" className="text-2xs text-stone-500">{SAVE_STATUS_LABEL[saveStatus]}</span>
      )}

      {showVersions && (
        <VersionDrawer
          salesOrderId={state.present.salesOrderId}
          currentVersion={state.present.version}
          onRestored={restoreVersion}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
