// Right-panel inspector for the selected piece: exact sizes, thickness,
// material line, corner radius, label, and the piece-level actions
// (rotate/duplicate/delete) that are this app's primary, keyboard-reachable
// path for them — DrawingCanvas's r/Delete keys (Task 7) are accelerators
// on top of this, not a substitute for it.

import { useState } from 'react';
import type { Piece } from '@/types/drawing';
import { bounds, rectOutline } from '@/lib/drawing/geometry';
import { validatePieceLabel } from '@/lib/drawing/labels';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

export function PieceInspector() {
  const { state } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const piece = area?.pieces.find((p) => p.id === state.selectedPieceId);

  if (!area || !piece) {
    return <p className="text-xs text-stone-500">No piece selected.</p>;
  }

  // Remounts (and so re-seeds every local field buffer) whenever the
  // selection changes.
  return <PieceFields key={piece.id} piece={piece} />;
}

function PieceFields({ piece }: { piece: Piece }) {
  const { state, dispatch, materialLines } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const { displayUnit, fractionDenominator } = state.present;
  const existingLabels = (area?.pieces ?? []).map((p) => p.label);
  const b = bounds(piece.outline);
  const lengthMm = b.maxX - b.minX;
  const widthMm = b.maxY - b.minY;
  const isRect = piece.shape === 'rect';

  const [label, setLabel] = useState(piece.label);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [length, setLength] = useState(() => formatLength(lengthMm, displayUnit, fractionDenominator));
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [width, setWidth] = useState(() => formatLength(widthMm, displayUnit, fractionDenominator));
  const [widthError, setWidthError] = useState<string | null>(null);
  const [thickness, setThickness] = useState(() => formatLength(piece.thicknessMm, displayUnit, fractionDenominator));
  const [thicknessError, setThicknessError] = useState<string | null>(null);
  const [cornerRadius, setCornerRadius] = useState(() => (
    piece.cornerRadiusMm === undefined ? '' : formatLength(piece.cornerRadiusMm, displayUnit, fractionDenominator)
  ));
  const [cornerRadiusError, setCornerRadiusError] = useState<string | null>(null);

  const dispatchPatch = (patch: Partial<Piece>) => {
    dispatch({ type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id, patch });
  };

  const commitLabel = () => {
    const error = validatePieceLabel(label, existingLabels, piece.label);
    setLabelError(error);
    if (!error) dispatchPatch({ label });
  };

  const commitLengthOrWidth = (which: 'length' | 'width', value: string, setError: (e: string | null) => void) => {
    try {
      const mm = parseLength(value);
      setError(null);
      dispatchPatch({
        outline: which === 'length' ? rectOutline(mm, widthMm) : rectOutline(lengthMm, mm),
      });
    } catch (e) {
      setError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  const commitThickness = () => {
    try {
      dispatchPatch({ thicknessMm: parseLength(thickness) });
      setThicknessError(null);
    } catch (e) {
      setThicknessError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  const commitCornerRadius = () => {
    if (!cornerRadius.trim()) {
      dispatchPatch({ cornerRadiusMm: undefined });
      setCornerRadiusError(null);
      return;
    }
    try {
      dispatchPatch({ cornerRadiusMm: parseLength(cornerRadius) });
      setCornerRadiusError(null);
    } catch (e) {
      setCornerRadiusError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <label className="flex flex-col gap-0.5">
        Label
        <input aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} className="rounded border border-stone-200 px-1.5 py-1" />
        {labelError && <span className="text-2xs text-destructive">{labelError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Length
        <input
          aria-label="Length"
          value={length}
          readOnly={!isRect}
          onChange={(e) => setLength(e.target.value)}
          onBlur={() => isRect && commitLengthOrWidth('length', length, setLengthError)}
          className="rounded border border-stone-200 px-1.5 py-1"
        />
        {lengthError && <span className="text-2xs text-destructive">{lengthError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Width
        <input
          aria-label="Width"
          value={width}
          readOnly={!isRect}
          onChange={(e) => setWidth(e.target.value)}
          onBlur={() => isRect && commitLengthOrWidth('width', width, setWidthError)}
          className="rounded border border-stone-200 px-1.5 py-1"
        />
        {widthError && <span className="text-2xs text-destructive">{widthError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Thickness
        <input aria-label="Thickness" value={thickness} onChange={(e) => setThickness(e.target.value)} onBlur={commitThickness} className="rounded border border-stone-200 px-1.5 py-1" />
        {thicknessError && <span className="text-2xs text-destructive">{thicknessError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Material line
        <select
          aria-label="Material line"
          value={piece.salesOrderLineId ?? ''}
          onChange={(e) => dispatchPatch({ salesOrderLineId: e.target.value || undefined })}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          <option value="">— none —</option>
          {materialLines.map((line) => (
            <option key={line.id} value={line.id}>{line.sku} — {line.itemName}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        Corner radius
        <input aria-label="Corner radius" value={cornerRadius} onChange={(e) => setCornerRadius(e.target.value)} onBlur={commitCornerRadius} className="rounded border border-stone-200 px-1.5 py-1" />
        {cornerRadiusError && <span className="text-2xs text-destructive">{cornerRadiusError}</span>}
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          aria-label={`Rotate ${piece.label}`}
          onClick={() => dispatch({ type: 'rotatePiece', areaId: state.activeAreaId, pieceId: piece.id })}
          className="rounded border border-stone-200 px-2 py-1"
        >
          Rotate 90°
        </button>
        <button
          type="button"
          aria-label={`Duplicate ${piece.label}`}
          onClick={() => dispatch({ type: 'duplicatePiece', areaId: state.activeAreaId, pieceId: piece.id, newId: crypto.randomUUID() })}
          className="rounded border border-stone-200 px-2 py-1"
        >
          Duplicate
        </button>
        <button
          type="button"
          aria-label={`Delete ${piece.label}`}
          onClick={() => dispatch({ type: 'deletePiece', areaId: state.activeAreaId, pieceId: piece.id })}
          className="rounded border border-stone-200 px-2 py-1 text-destructive"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
