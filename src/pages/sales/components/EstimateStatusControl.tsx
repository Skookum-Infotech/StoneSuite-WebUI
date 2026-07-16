import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { ESTIMATE_STATUS_CODES } from '@/lib/estimateForm';

// Status select for the Estimate Edit page, mirroring InvoiceStatusControl.
// Estimate has a small, fixed state machine (spec §7) with no
// admin-configurable states, so this is a static list rather than a fetched
// one. The backend (ValidateTransition) is the source of truth for which
// moves are legal from the current status — an illegal pick is rejected with
// 409, surfaced as a normal save error.
export function EstimateStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "DRFT"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = ESTIMATE_STATUS_CODES.find((s) => s.code === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`${fieldCls} flex items-center gap-2`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        <ChevronDown className="size-3 shrink-0 text-stone-400" />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {ESTIMATE_STATUS_CODES.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => { onChange(s.code); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                s.code === value ? 'bg-brand/10 font-semibold text-stone-900' : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
