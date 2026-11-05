// The inline forms behind the shape palette's "add piece" tools: each is a
// small set of parseLength-bound text inputs that builds a piece's outline
// from exact dimensions.

import { useId, useState } from 'react';
import { lShapeOutline, rectOutline, uShapeOutline } from '@/lib/drawing/geometry';
import { areaLetter, nextPieceLabel } from '@/lib/drawing/labels';
import { LengthParseError, parsePositiveLength } from '@/lib/drawing/units';
import { validateOutline } from '@/lib/drawing/validation';
import type { Piece, PieceKind } from '@/types/drawing';
import { useDrawingEditor } from './DrawingEditorContext';

function parseFieldOrError(value: string): { mm: number; error: null } | { mm: null; error: string } {
  try {
    // A piece dimension must be a real, positive length — parseLength alone
    // accepts "0" as valid (it is, as a length), which a caller checking the
    // result with a plain truthiness test treats as both "invalid" and "no
    // error message" at once.
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
        className="w-full rounded border border-stone-200 px-1.5 py-1"
      />
      {error && <span id={errorId} role="alert" className="text-2xs text-destructive">{error}</span>}
    </label>
  );
}

function useAddPiece() {
  const { state, dispatch } = useDrawingEditor();
  const areaIndex = state.present.areas.findIndex((a) => a.id === state.activeAreaId);
  const area = state.present.areas[areaIndex];

  return (shape: Piece['shape'], outline: Piece['outline'], thicknessMm: number, kind?: PieceKind) => {
    const id = crypto.randomUUID();
    dispatch({
      type: 'addPiece',
      areaId: state.activeAreaId,
      piece: {
        id,
        label: nextPieceLabel(areaLetter(areaIndex), area.pieces.map((p) => p.label)),
        shape,
        ...(kind ? { kind } : {}),
        outline,
        position: { x: 0, y: 0 },
        rotationDeg: 0,
        thicknessMm,
        edges: [],
        seams: [],
        cutouts: [],
      },
    });
    dispatch({ type: 'selectPiece', pieceId: id });
  };
}

export function AddRectangleForm({ kind, onDone }: { kind?: PieceKind; onDone: () => void }) {
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
    addPiece('rect', rectOutline(length.mm, width.mm), thickness.mm, kind);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-stone-200 bg-white p-2">
      <LengthField label="Length" value={values.length} onChange={(v) => setValues((s) => ({ ...s, length: v }))} error={errors.length ?? null} />
      <LengthField label="Width" value={values.width} onChange={(v) => setValues((s) => ({ ...s, width: v }))} error={errors.width ?? null} />
      <LengthField label="Thickness" value={values.thickness} onChange={(v) => setValues((s) => ({ ...s, thickness: v }))} error={errors.thickness ?? null} />
      <button type="button" onClick={submit} className="rounded bg-brand px-2 py-1 text-xs font-semibold">
        Add piece
      </button>
    </div>
  );
}

export function AddNotchedForm({ shape, onDone }: { shape: 'L' | 'U'; onDone: () => void }) {
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
    // Every field above is confirmed non-null by now; the casts match the
    // ones the outline-building call below already needs.
    const [length, width, notchLength, notchDepth, thickness] = [
      parsed.length.mm, parsed.width.mm, parsed.notchLength.mm, parsed.notchDepth.mm, parsed.thickness.mm,
    ] as number[];
    // A notch as large as (or larger than) the piece collapses an edge to
    // zero length or crosses outside the piece entirely.
    if (notchLength >= length || notchDepth >= width) {
      setErrors({ notchLength: 'The notch must be smaller than the piece.' });
      return;
    }
    const outline = shape === 'L'
      ? lShapeOutline(length, width, notchLength, notchDepth)
      : uShapeOutline(length, width, notchLength, notchDepth);
    const issues = validateOutline(outline);
    if (issues.length > 0) {
      setErrors({ notchLength: issues[0] });
      return;
    }
    addPiece(shape, outline, thickness);
    onDone();
  };

  const notchDepthLabel = shape === 'L' ? 'Notch width' : 'Notch depth';

  return (
    <div className="flex flex-col gap-2 rounded border border-stone-200 bg-white p-2">
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
