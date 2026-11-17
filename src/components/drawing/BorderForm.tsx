// The numbers for the Border tool, shown once a side has been clicked. Each
// input is named by the letter(s) its side(s) will carry on the drawing once
// applied (E, F, G ...), in the drawing's own unit. Typing re-draws the
// dashed preview on the canvas; Apply reshapes the side as one undo step.

import { useState } from 'react';
import type { Piece } from '@/types/drawing';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { applyBorder, borderFields, type BorderParams } from '@/lib/drawing/borders';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { validatePiece } from '@/lib/drawing/validation';
import { useDrawingEditor } from './DrawingEditorContext';

const INPUT_CLASS = 'w-24 rounded border border-stone-300 bg-white px-1.5 py-1 text-sm text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';

type Texts = Partial<Record<keyof BorderParams, string>>;

export function BorderForm({ piece, edgeIndex }: { piece: Piece; edgeIndex: number }) {
  const { state, dispatch, border } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const fields = borderFields(border.style, edgeIndex);
  const [texts, setTexts] = useState<Texts>(() => Object.fromEntries(
    fields.map((f) => [f.key, formatLength(border.params[f.key], displayUnit, fractionDenominator)]),
  ));
  const [error, setError] = useState<string | null>(null);

  /** The typed numbers over the last good ones; throws LengthParseError on a bad entry. */
  const parsed = (typed: Texts): BorderParams => {
    const next = { ...border.params };
    for (const { key } of fields) next[key] = parseLength(typed[key] ?? '');
    return next;
  };

  const onChange = (key: keyof BorderParams, value: string) => {
    const typed = { ...texts, [key]: value };
    setTexts(typed);
    setError(null);
    // Only a complete, readable entry moves the preview; half-typed text leaves it where it was.
    try {
      border.setParams(parsed(typed));
    } catch {
      /* still typing */
    }
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    let params: BorderParams;
    try {
      params = parsed(texts);
    } catch (err) {
      setError(err instanceof LengthParseError ? err.message : 'Enter a length.');
      return;
    }
    border.setParams(params);
    const result = applyBorder(piece, edgeIndex, border.style, params);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Checked against the real curved outline, so an arch cannot swallow a cutout or fold over the piece.
    const issues = validatePiece({ ...piece, outline: outlinePolyline(result.outline, result.edges) });
    if (issues.length > 0) {
      setError(issues[0]);
      return;
    }
    dispatch({
      type: 'updatePiece',
      areaId: state.activeAreaId,
      pieceId: piece.id,
      patch: {
        outline: result.outline,
        edges: result.edges,
        ...(result.outline === piece.outline ? {} : { shape: 'polygon' as const }),
      },
    });
    border.setTarget(null);
  };

  return (
    <form onSubmit={apply} aria-label="Border measurements" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {fields.map(({ key, letters, caption }, i) => (
        <label key={key} className="flex items-center gap-1.5 text-xs text-stone-300">
          <span className="font-semibold text-brand">{letters}</span>
          {caption}
          <input
            aria-label={`${letters}, ${caption.toLowerCase()}`}
            aria-invalid={error ? true : undefined}
            // The first number is what the user came to type: land on it.
            autoFocus={i === 0}
            value={texts[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      ))}
      <button
        type="submit"
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Apply
      </button>
      {error && <p role="alert" className="basis-full text-xs text-red-400">{error}</p>}
    </form>
  );
}
