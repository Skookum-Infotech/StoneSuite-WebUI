import type { FocusEvent, MouseEvent } from 'react';
import { DIMENSIONS_UNIT_HINT, normalizeUnit } from '@/lib/lineDimensions';
import { sanitizeThickness } from '@/lib/lineThickness';

const inputCls =
  'w-[4.5rem] rounded border border-stone-200 bg-white px-2 py-1 pr-6 text-right text-xs tabular-nums text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-300';

/** Lands on a box with its value selected, so typing replaces it. */
function selectAll(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

/** The mouse-up of the click that focused the box would drop that selection. */
function keepSelection(e: MouseEvent<HTMLInputElement>) {
  const box = e.currentTarget;
  if (box.value !== '' && box.selectionStart === 0 && box.selectionEnd === box.value.length) e.preventDefault();
}

/** The editable thickness cell of a purchase-order line, after Length / Width /
 *  Slabs. Thickness shares the unit of length and width — shown inside the box —
 *  and, like them, only means something on a line measured in sq ft or sq m, so
 *  `enabled` is false (and the box shows disabled) on any other line. */
export function LineThicknessInputCell({ value, unit, enabled, onChange }: {
  value: string;
  unit: string | undefined;
  enabled: boolean;
  onChange: (value: string) => void;
}) {
  const shownUnit = normalizeUnit(unit);
  return (
    <td className="px-2 py-1.5">
      <div className="relative">
        <input
          type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off"
          value={enabled ? value : ''} disabled={!enabled}
          title={enabled ? undefined : DIMENSIONS_UNIT_HINT}
          onChange={(e) => onChange(sanitizeThickness(e.target.value, unit))}
          onFocus={selectAll} onMouseUp={keepSelection}
          placeholder="0" aria-label={`Thickness (${shownUnit})`}
          className={inputCls}
        />
        {enabled && (
          <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-2xs text-stone-500" aria-hidden="true">
            {shownUnit}
          </span>
        )}
      </div>
    </td>
  );
}
