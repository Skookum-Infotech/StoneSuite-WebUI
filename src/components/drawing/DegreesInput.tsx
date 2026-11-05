// A labelled angle field (degrees), committing on blur or Enter. `onCommit`
// returns an error message to refuse the value, or null once it was saved.

import { useId, useState } from 'react';

function formatDegrees(deg: number): string {
  return String(Math.round(deg * 100) / 100);
}

export function DegreesInput({ label, valueDeg, onCommit }: {
  label: string;
  valueDeg: number;
  onCommit: (deg: number) => string | null;
}) {
  const shown = formatDegrees(valueDeg);
  const [text, setText] = useState(shown);
  const [seededWith, setSeededWith] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  if (seededWith !== shown) {
    setSeededWith(shown);
    setText(shown);
    setError(null);
  }

  const commit = () => {
    if (text.trim() === shown) return;
    const value = Number(text);
    if (text.trim() === '' || !Number.isFinite(value)) {
      setError('Enter an angle in degrees.');
      return;
    }
    setError(onCommit(value));
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
