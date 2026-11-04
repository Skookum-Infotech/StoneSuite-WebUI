// Top toolbar: add-piece tools (rectangle/L/U/polygon), undo/redo, and
// zoom controls. Each add-piece tool is a small inline form of
// parseLength-bound text inputs; polygon is a toggle that hands off to
// DrawingCanvas's click-to-place-points mode (see its own task).

import { useId, useState } from 'react';
import { lShapeOutline, rectOutline, uShapeOutline } from '@/lib/drawing/geometry';
import { areaLetter, nextPieceLabel } from '@/lib/drawing/labels';
import { parsePositiveLength, LengthParseError } from '@/lib/drawing/units';
import { ZOOM_STEP } from '@/lib/drawing/constants';
import type { Piece, Drawing } from '@/types/drawing';
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

type AddTool = 'none' | 'rect' | 'L' | 'U';

function parseFieldOrError(value: string): { mm: number; error: null } | { mm: null; error: string } {
  try {
    // A piece dimension must be a real, positive length — parseLength
    // alone accepts "0" as valid (it is, as a length), which a caller
    // checking the result with a plain truthiness test treats as both
    // "invalid" and "no error message" at once. Found in the final review
    // as a form that silently refused to submit on a zero-length field.
    return { mm: parsePositiveLength(value), error: null };
  } catch (e) {
    return { mm: null, error: e instanceof LengthParseError ? e.message : 'Enter a value.' };
  }
}

/** One labeled length input with its own inline error, used by every
 *  add-piece form below. */
function LengthField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error: string | null;
}) {
  const errorId = useId();
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      {label}
      <input
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded border border-stone-200 px-1.5 py-1"
      />
      {error && <span id={errorId} role="alert" className="text-2xs text-destructive">{error}</span>}
    </label>
  );
}

function useAddPiece() {
  const { state, dispatch } = useDrawingEditor();
  const areaIndex = state.present.areas.findIndex((a) => a.id === state.activeAreaId);
  const area = state.present.areas[areaIndex];

  return (shape: Piece['shape'], outline: Piece['outline'], thicknessMm: number) => {
    dispatch({
      type: 'addPiece',
      areaId: state.activeAreaId,
      piece: {
        id: crypto.randomUUID(),
        label: nextPieceLabel(areaLetter(areaIndex), area.pieces.map((p) => p.label)),
        shape,
        outline,
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm,
        edges: [],
        seams: [],
        cutouts: [],
      },
    });
  };
}

function AddRectangleForm({ onDone }: { onDone: () => void }) {
  const addPiece = useAddPiece();
  const [values, setValues] = useState({ length: '', width: '', thickness: '' });
  const [errors, setErrors] = useState<{ length?: string; width?: string; thickness?: string }>({});

  const submit = () => {
    const length = parseFieldOrError(values.length);
    const width = parseFieldOrError(values.width);
    const thickness = parseFieldOrError(values.thickness);
    if (length.mm === null || width.mm === null || thickness.mm === null) {
      setErrors({ length: length.error ?? undefined, width: width.error ?? undefined, thickness: thickness.error ?? undefined });
      return;
    }
    addPiece('rect', rectOutline(length.mm, width.mm), thickness.mm);
    onDone();
  };

  return (
    <div className="flex items-end gap-2 rounded border border-stone-200 bg-white p-2">
      <LengthField label="Length" value={values.length} onChange={(v) => setValues((s) => ({ ...s, length: v }))} error={errors.length ?? null} />
      <LengthField label="Width" value={values.width} onChange={(v) => setValues((s) => ({ ...s, width: v }))} error={errors.width ?? null} />
      <LengthField label="Thickness" value={values.thickness} onChange={(v) => setValues((s) => ({ ...s, thickness: v }))} error={errors.thickness ?? null} />
      <button type="button" onClick={submit} className="rounded bg-brand px-2 py-1 text-xs font-semibold">
        Add piece
      </button>
    </div>
  );
}

function AddNotchedForm({ shape, onDone }: { shape: 'L' | 'U'; onDone: () => void }) {
  const addPiece = useAddPiece();
  const [values, setValues] = useState({ length: '', width: '', notchLength: '', notchDepth: '', thickness: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = () => {
    const parsed = {
      length: parseFieldOrError(values.length),
      width: parseFieldOrError(values.width),
      notchLength: parseFieldOrError(values.notchLength),
      notchDepth: parseFieldOrError(values.notchDepth),
      thickness: parseFieldOrError(values.thickness),
    };
    if (Object.values(parsed).some((p) => p.mm === null)) {
      setErrors({
        length: parsed.length.error ?? undefined,
        width: parsed.width.error ?? undefined,
        notchLength: parsed.notchLength.error ?? undefined,
        notchDepth: parsed.notchDepth.error ?? undefined,
        thickness: parsed.thickness.error ?? undefined,
      });
      return;
    }
    // A notch as large as (or larger than) the piece collapses an edge to
    // zero length or crosses outside the piece entirely — found in the
    // final review as a degenerate/self-intersecting outline with no
    // warning. Every field above is confirmed non-null by now; the casts
    // match the ones the outline-building call below already needs.
    if ((parsed.notchLength.mm as number) >= (parsed.length.mm as number)
      || (parsed.notchDepth.mm as number) >= (parsed.width.mm as number)) {
      setErrors({ notchLength: 'The notch must be smaller than the piece.' });
      return;
    }
    const outline = shape === 'L'
      ? lShapeOutline(parsed.length.mm as number, parsed.width.mm as number, parsed.notchLength.mm as number, parsed.notchDepth.mm as number)
      : uShapeOutline(parsed.length.mm as number, parsed.width.mm as number, parsed.notchLength.mm as number, parsed.notchDepth.mm as number);
    addPiece(shape, outline, parsed.thickness.mm as number);
    onDone();
  };

  const notchDepthLabel = shape === 'L' ? 'Notch width' : 'Notch depth';

  return (
    <div className="flex items-end gap-2 rounded border border-stone-200 bg-white p-2">
      <LengthField label="Length" value={values.length} onChange={(v) => setValues((s) => ({ ...s, length: v }))} error={errors.length ?? null} />
      <LengthField label="Width" value={values.width} onChange={(v) => setValues((s) => ({ ...s, width: v }))} error={errors.width ?? null} />
      <LengthField label="Notch length" value={values.notchLength} onChange={(v) => setValues((s) => ({ ...s, notchLength: v }))} error={errors.notchLength ?? null} />
      <LengthField label={notchDepthLabel} value={values.notchDepth} onChange={(v) => setValues((s) => ({ ...s, notchDepth: v }))} error={errors.notchDepth ?? null} />
      <LengthField label="Thickness" value={values.thickness} onChange={(v) => setValues((s) => ({ ...s, thickness: v }))} error={errors.thickness ?? null} />
      <button type="button" onClick={submit} className="rounded bg-brand px-2 py-1 text-xs font-semibold">
        Add piece
      </button>
    </div>
  );
}

export function DrawingToolbar({ saveStatus }: { saveStatus: AutosaveStatus }) {
  const { state, dispatch, tool, setTool, fitToArea } = useDrawingEditor();
  const [addTool, setAddTool] = useState<AddTool>('none');
  const [showVersions, setShowVersions] = useState(false);

  const toggleAddTool = (next: AddTool) => setAddTool((current) => (current === next ? 'none' : next));
  const restoreVersion = (restored: Drawing) => {
    dispatch({ type: 'loadDrawing', drawing: restored });
    setShowVersions(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => toggleAddTool('rect')} aria-pressed={addTool === 'rect'} className="rounded border border-stone-200 px-2 py-1 text-xs">
          Add rectangle
        </button>
        <button type="button" onClick={() => toggleAddTool('L')} aria-pressed={addTool === 'L'} className="rounded border border-stone-200 px-2 py-1 text-xs">
          Add L-shape
        </button>
        <button type="button" onClick={() => toggleAddTool('U')} aria-pressed={addTool === 'U'} className="rounded border border-stone-200 px-2 py-1 text-xs">
          Add U-shape
        </button>
        <button
          type="button"
          onClick={() => setTool(tool === 'polygon' ? 'select' : 'polygon')}
          aria-pressed={tool === 'polygon'}
          aria-label="Add polygon"
          className="rounded border border-stone-200 px-2 py-1 text-xs"
        >
          Add polygon
        </button>

        <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

        <button type="button" aria-label="Undo" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })} className="rounded border border-stone-200 px-2 py-1 text-xs disabled:opacity-40">
          Undo
        </button>
        <button type="button" aria-label="Redo" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })} className="rounded border border-stone-200 px-2 py-1 text-xs disabled:opacity-40">
          Redo
        </button>

        <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

        <button type="button" aria-label="Zoom out" onClick={() => dispatch({ type: 'setZoom', zoom: state.zoom - ZOOM_STEP })} className="rounded border border-stone-200 px-2 py-1 text-xs">
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => dispatch({ type: 'setZoom', zoom: state.zoom + ZOOM_STEP })} className="rounded border border-stone-200 px-2 py-1 text-xs">
          +
        </button>
        <button type="button" aria-label="Fit area" onClick={fitToArea} className="rounded border border-stone-200 px-2 py-1 text-xs">
          Fit
        </button>

        <span className="mx-2 h-5 w-px bg-stone-200" aria-hidden="true" />

        <button type="button" onClick={() => setShowVersions(true)} className="rounded border border-stone-200 px-2 py-1 text-xs">
          Version history
        </button>
        {saveStatus !== 'idle' && (
          <span role="status" className="text-2xs text-stone-500">{SAVE_STATUS_LABEL[saveStatus]}</span>
        )}
      </div>

      {addTool === 'rect' && <AddRectangleForm onDone={() => setAddTool('none')} />}
      {addTool === 'L' && <AddNotchedForm shape="L" onDone={() => setAddTool('none')} />}
      {addTool === 'U' && <AddNotchedForm shape="U" onDone={() => setAddTool('none')} />}

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
