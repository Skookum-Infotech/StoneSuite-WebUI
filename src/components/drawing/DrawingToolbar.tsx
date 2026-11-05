// Top toolbar: save, undo/redo, zoom, DXF export and version history. The tools
// that add pieces and cutouts live in the left panel (ShapePalette,
// CutoutLibrary).

import { useState } from 'react';
import { toast } from 'sonner';
import { buildAreaExport, downloadDxf } from '@/lib/drawing/dxfDownload';
import { ZOOM_STEP } from '@/lib/drawing/constants';
import type { Drawing } from '@/types/drawing';
import type { AutosaveStatus } from './useDrawingAutosave';
import { VersionDrawer } from './VersionDrawer';
import { useDrawingEditor } from './DrawingEditorContext';

const SAVE_BUTTON_LABEL: Record<AutosaveStatus, string> = {
  idle: 'Saved',
  dirty: 'Save',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Retry save',
};

const SAVE_STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: '',
  dirty: 'Unsaved changes — autosaves shortly',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Save failed — your changes are not saved',
};

const BUTTON_CLASS = 'rounded border border-stone-200 px-2 py-1 text-xs disabled:opacity-40';

export function DrawingToolbar(
  { saveStatus, onSave, orderNumber }: { saveStatus: AutosaveStatus; onSave: () => void; orderNumber: string },
) {
  const { state, dispatch, fitToArea } = useDrawingEditor();
  const [showVersions, setShowVersions] = useState(false);

  const restoreVersion = (restored: Drawing) => {
    dispatch({ type: 'loadDrawing', drawing: restored });
    setShowVersions(false);
  };

  const exportDxf = () => {
    const file = buildAreaExport(state.present, state.activeAreaId, orderNumber);
    if (!file) return;
    downloadDxf(file.fileName, file.content);
    toast.success(`Exported ${file.fileName}`);
  };
  const canSave = saveStatus === 'dirty' || saveStatus === 'error';
  const statusTone = saveStatus === 'error' ? 'text-destructive' : saveStatus === 'dirty' ? 'text-amber-700' : 'text-stone-500';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Save drawing"
        disabled={!canSave}
        onClick={onSave}
        className="rounded bg-brand px-3 py-1 text-xs font-medium text-white disabled:bg-stone-200 disabled:text-stone-500"
      >
        {SAVE_BUTTON_LABEL[saveStatus]}
      </button>
      <span role="status" className={`min-w-44 text-2xs ${statusTone}`}>{SAVE_STATUS_TEXT[saveStatus]}</span>

      <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

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

      <button type="button" aria-label="Export DXF" onClick={exportDxf} className={BUTTON_CLASS}>
        Export DXF
      </button>
      <button type="button" onClick={() => setShowVersions(true)} className={BUTTON_CLASS}>
        Version history
      </button>

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
