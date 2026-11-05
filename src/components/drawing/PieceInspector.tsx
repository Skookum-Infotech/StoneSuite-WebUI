// Right-panel inspector for the selected piece: exact sizes, thickness,
// material line, corner radius, label, and the piece-level actions
// (rotate/duplicate/delete) that are this app's primary, keyboard-reachable
// path for them — DrawingCanvas's r/Delete keys (Task 7) are accelerators
// on top of this, not a substitute for it.

import { useEffect, useId, useRef, useState } from 'react';
import type { Piece } from '@/types/drawing';
import { bounds, rectOutline } from '@/lib/drawing/geometry';
import { validatePieceLabel } from '@/lib/drawing/labels';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

/** Tolerance for treating a re-typed length as "the same value" rather
 *  than a real edit. An untouched field's displayed text already went
 *  through one formatLength -> parseLength round-trip at the drawing's
 *  1/32" fraction precision, which quantizes by up to half of 25.4/32mm
 *  (~0.4mm) even when nothing changed — this has to clear that, not just
 *  floating-point noise, or every untouched field reads as "changed". */
const MM_EPSILON = 0.5;

function almostEqualMm(a: number, b: number): boolean {
  return Math.abs(a - b) < MM_EPSILON;
}

export function PieceInspector() {
  const { state } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const piece = area?.pieces.find((p) => p.id === state.selectedPieceId);
  const noSelectionRef = useRef<HTMLParagraphElement>(null);
  // Set only by the Delete button's own click below — deleting the piece
  // unmounts the whole field tree (the button included), which would
  // otherwise strand keyboard focus on <body> with no indication where it
  // went. Scoped to that one action so other deselection paths (e.g. the
  // canvas's own Delete key, which refocuses the canvas itself) aren't
  // overridden by this effect firing too. Found in the a11y review.
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    if (!piece && pendingFocusRef.current) {
      noSelectionRef.current?.focus();
      pendingFocusRef.current = false;
    }
  }, [piece]);

  if (!area || !piece) {
    return <p ref={noSelectionRef} tabIndex={-1} className="text-xs text-stone-500 outline-none">No piece selected.</p>;
  }

  // Remounts (and so re-seeds every local field buffer) whenever the
  // selection changes.
  return <PieceFields key={piece.id} piece={piece} onDeleteClick={() => { pendingFocusRef.current = true; }} />;
}

function PieceFields({ piece, onDeleteClick }: { piece: Piece; onDeleteClick: () => void }) {
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
  const labelErrorId = useId();
  const [length, setLength] = useState(() => formatLength(lengthMm, displayUnit, fractionDenominator));
  const [lengthError, setLengthError] = useState<string | null>(null);
  const lengthErrorId = useId();
  const [width, setWidth] = useState(() => formatLength(widthMm, displayUnit, fractionDenominator));
  const [widthError, setWidthError] = useState<string | null>(null);
  const widthErrorId = useId();
  const [thickness, setThickness] = useState(() => formatLength(piece.thicknessMm, displayUnit, fractionDenominator));
  const [thicknessError, setThicknessError] = useState<string | null>(null);
  const thicknessErrorId = useId();
  const [cornerRadius, setCornerRadius] = useState(() => (
    piece.cornerRadiusMm === undefined ? '' : formatLength(piece.cornerRadiusMm, displayUnit, fractionDenominator)
  ));
  const [cornerRadiusError, setCornerRadiusError] = useState<string | null>(null);
  const cornerRadiusErrorId = useId();

  // Re-seed every field whenever the piece itself changes under us — found
  // in the final review: undo/redo/rotate left these fields showing the
  // pre-undo text, and tabbing through them again silently re-applied the
  // undone edit. `piece` only gets a new reference when this specific
  // piece's data actually changed (the reducer returns other pieces'
  // objects untouched), so this doesn't fire on unrelated edits. Adjusting
  // state during render (React's own recipe for "reset state when a prop
  // changes") rather than in a useEffect, which would cascade an extra
  // render for no benefit here.
  const [seededFor, setSeededFor] = useState(piece);
  if (seededFor !== piece) {
    setSeededFor(piece);
    setLabel(piece.label);
    setLabelError(null);
    setLength(formatLength(lengthMm, displayUnit, fractionDenominator));
    setLengthError(null);
    setWidth(formatLength(widthMm, displayUnit, fractionDenominator));
    setWidthError(null);
    setThickness(formatLength(piece.thicknessMm, displayUnit, fractionDenominator));
    setThicknessError(null);
    setCornerRadius(piece.cornerRadiusMm === undefined ? '' : formatLength(piece.cornerRadiusMm, displayUnit, fractionDenominator));
    setCornerRadiusError(null);
  }

  const dispatchPatch = (patch: Partial<Piece>) => {
    dispatch({ type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id, patch });
  };

  const commitLabel = () => {
    const trimmed = label.trim();
    const error = validatePieceLabel(trimmed, existingLabels, piece.label);
    setLabelError(error);
    if (error) return;
    setLabel(trimmed);
    // Blur fires on every field whose focus is simply moving away — e.g.
    // clicking Undo right after editing another field blurs this one
    // first. Skipping an unchanged value stops that from pushing a
    // redundant history entry on top of the real edit (found in the final
    // review while testing the stale-field fix above: a single Undo was
    // reverting this phantom re-commit instead of the user's actual edit).
    if (trimmed === piece.label) return;
    dispatchPatch({ label: trimmed });
  };

  const commitLengthOrWidth = (which: 'length' | 'width', value: string, setError: (e: string | null) => void) => {
    try {
      const mm = parseLength(value);
      setError(null);
      if (almostEqualMm(mm, which === 'length' ? lengthMm : widthMm)) return;
      dispatchPatch({
        outline: which === 'length' ? rectOutline(mm, widthMm) : rectOutline(lengthMm, mm),
      });
    } catch (e) {
      setError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  const commitThickness = () => {
    try {
      const mm = parseLength(thickness);
      setThicknessError(null);
      if (almostEqualMm(mm, piece.thicknessMm)) return;
      dispatchPatch({ thicknessMm: mm });
    } catch (e) {
      setThicknessError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  const commitCornerRadius = () => {
    if (!cornerRadius.trim()) {
      setCornerRadiusError(null);
      if (piece.cornerRadiusMm === undefined) return;
      dispatchPatch({ cornerRadiusMm: undefined });
      return;
    }
    try {
      const mm = parseLength(cornerRadius);
      setCornerRadiusError(null);
      if (piece.cornerRadiusMm !== undefined && almostEqualMm(mm, piece.cornerRadiusMm)) return;
      dispatchPatch({ cornerRadiusMm: mm });
    } catch (e) {
      setCornerRadiusError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <label className="flex flex-col gap-0.5">
        Label
        <input aria-label="Label" aria-describedby={labelError ? labelErrorId : undefined} value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} className="rounded border border-stone-200 px-1.5 py-1" />
        {labelError && <span id={labelErrorId} role="alert" className="text-2xs text-destructive">{labelError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Length
        <input
          aria-label="Length"
          aria-describedby={lengthError ? lengthErrorId : undefined}
          value={length}
          readOnly={!isRect}
          onChange={(e) => setLength(e.target.value)}
          onBlur={() => isRect && commitLengthOrWidth('length', length, setLengthError)}
          className="rounded border border-stone-200 px-1.5 py-1"
        />
        {lengthError && <span id={lengthErrorId} role="alert" className="text-2xs text-destructive">{lengthError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Width
        <input
          aria-label="Width"
          aria-describedby={widthError ? widthErrorId : undefined}
          value={width}
          readOnly={!isRect}
          onChange={(e) => setWidth(e.target.value)}
          onBlur={() => isRect && commitLengthOrWidth('width', width, setWidthError)}
          className="rounded border border-stone-200 px-1.5 py-1"
        />
        {widthError && <span id={widthErrorId} role="alert" className="text-2xs text-destructive">{widthError}</span>}
      </label>

      <label className="flex flex-col gap-0.5">
        Thickness
        <input aria-label="Thickness" aria-describedby={thicknessError ? thicknessErrorId : undefined} value={thickness} onChange={(e) => setThickness(e.target.value)} onBlur={commitThickness} className="rounded border border-stone-200 px-1.5 py-1" />
        {thicknessError && <span id={thicknessErrorId} role="alert" className="text-2xs text-destructive">{thicknessError}</span>}
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
        <input aria-label="Corner radius" aria-describedby={cornerRadiusError ? cornerRadiusErrorId : undefined} value={cornerRadius} onChange={(e) => setCornerRadius(e.target.value)} onBlur={commitCornerRadius} className="rounded border border-stone-200 px-1.5 py-1" />
        {cornerRadiusError && <span id={cornerRadiusErrorId} role="alert" className="text-2xs text-destructive">{cornerRadiusError}</span>}
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
          onClick={() => {
            onDeleteClick();
            dispatch({ type: 'deletePiece', areaId: state.activeAreaId, pieceId: piece.id });
          }}
          className="rounded border border-stone-200 px-2 py-1 text-destructive"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
