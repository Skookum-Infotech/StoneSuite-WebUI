// The row of numbers a Border or Corner change asks for, shown once a side or
// corner has been clicked. Each input is named by the letter(s) of the side(s)
// it belongs to (the drawing's own lettering), in the drawing's own unit.
// Typing re-draws the dashed preview on the canvas; Apply hands the numbers to
// the tool, which either does the edit (one undo step) or says why it cannot.

import { useState } from 'react';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
const INPUT_CLASS = 'w-24 rounded border border-stone-300 bg-white px-1.5 py-1 text-sm text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';

export interface MeasurementField<K extends string> {
  key: K;
  /** The side letter(s) the number is for, e.g. "E" or "F, H". */
  letters: string;
  caption: string;
}

export function MeasurementsForm<K extends string>({ label, fields, values, onPreview, onApply }: {
  /** The form's accessible name, e.g. "Border measurements". */
  label: string;
  fields: MeasurementField<K>[];
  /** The numbers every input starts with (all keys, not just the asked ones). */
  values: Record<K, number>;
  /** Called with the full set of numbers each time the typed text reads as lengths. */
  onPreview: (values: Record<K, number>) => void;
  /** Called with the full set on Apply; returns why it failed, or null once done. */
  onApply: (values: Record<K, number>) => string | null;
}) {
  const { state } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const [texts, setTexts] = useState<Partial<Record<K, string>>>(() => Object.fromEntries(
    fields.map((f) => [f.key, formatLength(values[f.key], displayUnit, fractionDenominator)]),
  ) as Partial<Record<K, string>>);
  const [error, setError] = useState<string | null>(null);

  /** The typed numbers over the starting ones; throws LengthParseError on a bad entry. */
  const parsed = (typed: Partial<Record<K, string>>): Record<K, number> => {
    const next = { ...values };
    for (const { key } of fields) next[key] = parseLength(typed[key] ?? '');
    return next;
  };

  const onChange = (key: K, value: string) => {
    const typed = { ...texts, [key]: value };
    setTexts(typed);
    setError(null);
    // Only a complete, readable entry moves the preview; half-typed text leaves it where it was.
    try {
      onPreview(parsed(typed));
    } catch {
      /* still typing */
    }
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    let typed: Record<K, number>;
    try {
      typed = parsed(texts);
    } catch (err) {
      setError(err instanceof LengthParseError ? err.message : 'Enter a length.');
      return;
    }
    onPreview(typed);
    setError(onApply(typed));
  };

  return (
    <form onSubmit={apply} aria-label={label} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {fields.map(({ key, letters, caption }, i) => (
        <label key={key} className="flex items-center gap-1.5 type-field-label">
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
        className={buttonVariants()}
      >
        Apply
      </button>
      {error && <p role="alert" className="basis-full type-error">{error}</p>}
    </form>
  );
}
