import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldCls, fieldErrorCls } from '@/components/crm/formUtils';
import { parseMonthYearValue, formatMonthYearValue } from '@/lib/monthYearValue';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface MonthYearPickerProps {
  /** "yyyy-mm", or "" when unset — the same shape <input type="month"> uses. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  placeholder?: string;
}

// A dedicated month/year picker: a field-styled trigger button showing the
// selected month ("October 2024"), opening a popover with a year navigator
// and a 3x4 grid of months. Hand-rolled to the same anchored-panel +
// outside-click convention as AccountPicker.tsx (this repo has no Popover
// primitive in components/ui) rather than a full modal — this is a
// lightweight, non-blocking field control, not a dialog.
export function MonthYearPicker({
  value, onChange, invalid, ariaLabel = 'Select month and year', ariaDescribedBy, placeholder = 'Select a month',
}: MonthYearPickerProps) {
  const selected = parseMonthYearValue(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Re-centers the year navigator on whatever is currently selected each
  // time the popover opens, rather than drifting with wherever it was left.
  function toggleOpen() {
    if (!open) setViewYear(selected?.year ?? today.getFullYear());
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function selectMonth(month: number) {
    onChange(formatMonthYearValue(viewYear, month));
    setOpen(false);
    triggerRef.current?.focus();
  }

  const displayLabel = selected ? `${MONTH_FULL[selected.month - 1]} ${selected.year}` : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(invalid ? fieldErrorCls : fieldCls, 'flex items-center gap-2 text-left', !selected && 'text-stone-400')}
      >
        <CalendarDays className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate">{displayLabel}</span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-stone-400 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-72 origin-top rounded-xl border border-stone-200 bg-white p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-bold tabular-nums text-stone-900">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_ABBR.map((label, i) => {
              const month = i + 1;
              const isSelected = selected?.year === viewYear && selected.month === month;
              const isCurrent = viewYear === today.getFullYear() && month === today.getMonth() + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectMonth(month)}
                  aria-pressed={isSelected}
                  aria-label={`${MONTH_FULL[i]} ${viewYear}`}
                  className={cn(
                    'relative rounded-lg py-2 text-xs font-semibold transition-colors',
                    isSelected ? 'bg-brand text-stone-950 shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                  )}
                >
                  {label}
                  {isCurrent && !isSelected && (
                    <span
                      className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand-dark"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
