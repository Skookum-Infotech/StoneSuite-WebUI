import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import {
  DIMENSIONS_UNIT_HINT, DIMENSION_STEP, DIMENSION_STEP_COARSE, sanitizeDimensionInput, stepDimension,
  type DimensionField, type DimensionUnit,
} from '@/lib/lineDimensions';

const inputCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-300';

// The unit sits inside the box, right-aligned after the number, so which unit a
// line is in is read where the number is typed — it differs per item.
const unitCls = 'pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-2xs text-stone-500';

const EDITABLE_BOX = 'input:not([disabled]):not([readonly])';

/** Lands on a box with its value selected, so typing replaces it instead of
 *  being appended to a figure the user then has to delete first. */
function selectAll(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

/** The mouse-up of the click that focused a box would drop that selection
 *  again; it is kept while everything is still selected. */
function keepSelection(e: MouseEvent<HTMLInputElement>) {
  const box = e.currentTarget;
  if (box.value !== '' && box.selectionStart === 0 && box.selectionEnd === box.value.length) e.preventDefault();
}

/** Enter reads as "next box" — what Tab does — within the line's row. */
function focusNextBox(from: HTMLInputElement) {
  const boxes = Array.from(from.closest('tr')?.querySelectorAll<HTMLInputElement>(EDITABLE_BOX) ?? []);
  boxes[boxes.indexOf(from) + 1]?.focus();
}

/** The three editable cells — length, width, slabs — that sit between SKU and
 *  Units in a line-item row. Length and width are always the same unit (`unit`),
 *  which the line took from its item; `enabled` is false for a line whose unit
 *  isn't an area unit (or that has no item yet), where "length x width" means
 *  nothing, so the cells show but can't be edited.
 *
 *  They are text boxes with a number keypad rather than `type="number"` ones: the
 *  browser's spinner arrows sat on top of the value and the unit, a scroll over a
 *  focused box changed the figure, and letters, "e" and "-" were all accepted.
 *  Here only digits (and one decimal point) get in, the whole value is selected
 *  on focus, Enter moves on instead of saving the document, and the arrow keys
 *  still step the value (Shift for ten). */
export function LineDimensionInputCells({ dims, unit, enabled, onChange }: {
  dims: Record<DimensionField, string>;
  unit: DimensionUnit;
  enabled: boolean;
  onChange: (key: DimensionField, value: string) => void;
}) {
  const title = enabled ? undefined : DIMENSIONS_UNIT_HINT;

  const onKeyDown = (field: DimensionField) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusNextBox(e.currentTarget);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const amount = e.shiftKey ? DIMENSION_STEP_COARSE : DIMENSION_STEP;
      onChange(field, stepDimension(field, dims[field], e.key === 'ArrowUp' ? 1 : -1, amount));
    }
  };

  // Length and width carry the unit inside the box; the slab count has none.
  const box = (field: DimensionField, label: string) => {
    const isSize = field !== 'slabs';
    return (
      <td className="px-2 py-1.5">
        <div className="relative">
          <input
            type="text" inputMode={isSize ? 'decimal' : 'numeric'} enterKeyHint="next" autoComplete="off"
            value={enabled ? dims[field] : ''} disabled={!enabled} title={title}
            onChange={(e) => onChange(field, sanitizeDimensionInput(field, e.target.value))}
            onFocus={selectAll} onMouseUp={keepSelection} onKeyDown={onKeyDown(field)}
            placeholder={isSize ? '0' : '1'} aria-label={isSize ? `${label} (${unit})` : label}
            className={cn(inputCls, isSize ? 'w-[4.5rem] pr-6' : 'w-14')}
          />
          {isSize && enabled && <span className={unitCls} aria-hidden="true">{unit}</span>}
        </div>
      </td>
    );
  };

  return (
    <>
      {box('length', 'Length')}
      {box('width', 'Width')}
      {box('slabs', 'Slabs')}
    </>
  );
}
