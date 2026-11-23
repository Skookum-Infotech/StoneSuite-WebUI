// A labelled length field for the inspector. Shows the value in the drawing's
// display unit (fractional inches or mm), accepts anything parseLength does,
// and commits on blur. `onCommit` returns an error message to refuse the
// value (it stays in the box next to the message) or null once it was saved.
// An unedited field is never re-committed — comparing the typed text to the
// text it was seeded with, not the underlying mm, so the rounding of a
// 1/32" display can't make an untouched field look changed (or swallow a real
// sub-1/32" edit in millimetres).

import { useId, useState } from 'react';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

export function LengthInput({ label, valueMm, onCommit }: {
  label: string;
  valueMm: number;
  onCommit: (mm: number) => string | null;
}) {
  const { state } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const formatted = formatLength(valueMm, displayUnit, fractionDenominator);
  const [text, setText] = useState(formatted);
  const [seededWith, setSeededWith] = useState(formatted);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  // The value changed underneath us (undo, a drag, another field): re-seed.
  if (seededWith !== formatted) {
    setSeededWith(formatted);
    setText(formatted);
    setError(null);
  }

  const commit = () => {
    if (text.trim() === formatted) {
      setError(null);
      return;
    }
    try {
      setError(onCommit(parseLength(text)));
    } catch (e) {
      setError(e instanceof LengthParseError ? e.message : 'Enter a value.');
    }
  };

  return (
    <label className="flex flex-col gap-0.5">
      {label}
      <input
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        className="rounded border border-stone-200 px-1.5 py-1"
      />
      {error && <span id={errorId} role="alert" className="text-2xs text-destructive">{error}</span>}
    </label>
  );
}
