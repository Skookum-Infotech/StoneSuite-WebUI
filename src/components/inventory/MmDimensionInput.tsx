import { useState } from 'react';
import { cn } from '@/lib/utils';
import { dimensionToMm, mmToDimension } from '@/lib/lineDimensions';

const MM_MATCH_TOLERANCE = 0.005;

// A slab's size is kept in millimetres, but the receiver works in the item's own
// unit (inches, say), so this input shows and takes that unit and hands back
// millimetres. While the receiver is typing it keeps their exact text — "96." or
// "1.1" must not be rewritten under the cursor — and only falls back to the
// converted figure when the size is changed from somewhere else (a bulk fill).
export function MmDimensionInput({ valueMm, onChangeMm, unit, label, className }: {
  valueMm: string;
  onChangeMm: (mm: string) => void;
  unit: string;
  label: string;
  className?: string;
}) {
  const [typed, setTyped] = useState<string | null>(null);

  const stored = parseFloat(valueMm);
  const converted = Number.isFinite(stored) ? String(mmToDimension(stored, unit)) : '';
  const typedNumber = typed === null ? NaN : parseFloat(typed);
  const typedMatchesStored = typed !== null && (
    Number.isFinite(typedNumber)
      ? Number.isFinite(stored) && Math.abs(dimensionToMm(typedNumber, unit) - stored) < MM_MATCH_TOLERANCE
      : !Number.isFinite(stored)
  );
  const shown = typedMatchesStored ? (typed as string) : converted;

  function change(raw: string) {
    setTyped(raw);
    const n = parseFloat(raw);
    onChangeMm(Number.isFinite(n) ? String(dimensionToMm(n, unit)) : '');
  }

  return (
    <input
      type="number" min="0" step="any" inputMode="decimal"
      value={shown}
      onChange={(e) => change(e.target.value)}
      aria-label={label}
      className={cn(className)}
    />
  );
}
