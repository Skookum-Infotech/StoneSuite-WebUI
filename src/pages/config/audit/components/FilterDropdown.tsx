import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: FilterOption[];
}

// A button + custom listbox panel, not a native <select>: the browser's
// native dropdown popup ignores page CSS (including the app's modal-scrollbar
// utility), so a long option list — Resource has 26 entries, Action has 12 —
// scrolls with a jarring OS-native scrollbar. This gets the same thin
// scrollbar as every other scrollable panel in the app. Pattern follows
// components/crm/StatusDropdown.tsx.
export function FilterDropdown({ label, value, onChange, allLabel, options }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const disabled = options.length === 0;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? allLabel;

  return (
    <div className="flex flex-col gap-1">
      <span
        id={triggerId}
        className="text-2xs font-semibold uppercase tracking-wider text-stone-400"
      >
        {label}
      </span>
      <div ref={containerRef} className="relative sm:w-44">
        <button
          type="button"
          aria-labelledby={triggerId}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value ? 'text-stone-900' : 'text-stone-400',
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="size-3 shrink-0 text-stone-400" />
        </button>

        {open && !disabled && (
          <div
            role="listbox"
            aria-labelledby={triggerId}
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto modal-scrollbar rounded-xl border border-stone-200 bg-white py-1 shadow-md"
          >
            <DropdownOption
              selected={value === ''}
              label={allLabel}
              onSelect={() => {
                onChange('');
                setOpen(false);
              }}
            />
            {options.map((o) => (
              <DropdownOption
                key={o.value}
                selected={o.value === value}
                label={o.label}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DropdownOption({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
        selected ? 'bg-brand/10 font-semibold text-stone-900' : 'text-stone-600 hover:bg-stone-50',
      )}
    >
      <Check className={cn('size-3 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
      <span className="truncate">{label}</span>
    </button>
  );
}
