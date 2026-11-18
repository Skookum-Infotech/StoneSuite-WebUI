// Top bar, in three parts: full screen, DXF export and version history as small
// icons on the left; the Sketch / Cutout / Material switch in the middle; undo,
// redo and the save button on the right. The tools that add pieces live in the
// left rail (ShapePalette), the cutout tools in the Cutout panel.

import { useState } from 'react';
import { AlertTriangle, Check, Download, History, Loader2, Maximize2, Minimize2, Redo2, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildAreaExport, downloadDxf } from '@/lib/drawing/dxfDownload';
import type { Drawing } from '@/types/drawing';
import type { AutosaveStatus } from './useDrawingAutosave';
import { VersionDrawer } from './VersionDrawer';
import { useDrawingEditor } from './DrawingEditorContext';
import { useFullscreen } from './useFullscreen';
import { WorkspaceTabs } from './WorkspaceTabs';

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

const SAVE_ICON: Record<AutosaveStatus, typeof Save> = {
  idle: Check,
  dirty: Save,
  saving: Loader2,
  saved: Check,
  error: AlertTriangle,
};

const SAVE_TONE: Record<AutosaveStatus, string> = {
  idle: 'text-stone-500',
  dirty: 'bg-brand text-stone-900 hover:bg-brand-hover',
  saving: 'text-stone-500',
  saved: 'text-stone-500',
  error: 'border border-destructive text-destructive hover:bg-stone-100',
};

const ICON_BUTTON_CLASS = 'flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent';
const ICON_CLASS = 'h-4 w-4';

export function DrawingToolbar(
  { saveStatus, onSave, orderNumber }: { saveStatus: AutosaveStatus; onSave: () => void; orderNumber: string },
) {
  const { state, dispatch } = useDrawingEditor();
  const [showVersions, setShowVersions] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

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
  const SaveIcon = SAVE_ICON[saveStatus];
  const fullscreenLabel = isFullscreen ? 'Exit full screen' : 'Full screen';
  const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          aria-pressed={isFullscreen}
          onClick={(e) => toggleFullscreen(e.currentTarget.closest('[data-drawing-editor]'))}
          className={ICON_BUTTON_CLASS}
        >
          <FullscreenIcon className={ICON_CLASS} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Export DXF" title="Export DXF" onClick={exportDxf} className={ICON_BUTTON_CLASS}>
          <Download className={ICON_CLASS} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Version history" title="Version history" onClick={() => setShowVersions(true)} className={ICON_BUTTON_CLASS}>
          <History className={ICON_CLASS} aria-hidden="true" />
        </button>
      </div>

      <WorkspaceTabs />

      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
          className={ICON_BUTTON_CLASS}
        >
          <Undo2 className={ICON_CLASS} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })}
          className={ICON_BUTTON_CLASS}
        >
          <Redo2 className={ICON_CLASS} aria-hidden="true" />
        </button>
        {/* The status sentence is the button's tooltip and, for screen readers,
            a live region — it no longer takes room on the bar. */}
        <span role="status" className="sr-only">{SAVE_STATUS_TEXT[saveStatus]}</span>
        <button
          type="button"
          aria-label="Save drawing"
          title={SAVE_STATUS_TEXT[saveStatus] || SAVE_BUTTON_LABEL[saveStatus]}
          disabled={!canSave}
          onClick={onSave}
          className={`ml-1 flex h-7 items-center gap-1 rounded px-2 text-2xs font-medium ${SAVE_TONE[saveStatus]}`}
        >
          <SaveIcon className={`${ICON_CLASS} ${saveStatus === 'saving' ? 'animate-spin' : ''}`} aria-hidden="true" />
          {SAVE_BUTTON_LABEL[saveStatus]}
        </button>
      </div>

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
