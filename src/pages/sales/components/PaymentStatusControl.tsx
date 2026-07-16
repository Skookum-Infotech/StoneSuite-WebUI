import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS } from '@/lib/paymentForm';

// Status select for the Payment Edit page. Unlike InvoiceStatusControl (which
// offers Invoice's full flat status list — every status is reachable in
// sequence from the UI), Payment's transitions branch: PEND can go to APPV or
// VOID, APPV to DEPO or VOID, and DEPO/VOID are terminal. This control only
// offers the current status plus its legal next-moves (backend spec §7). The
// backend (payment.Transition) remains the source of truth; an illegal pick
// would be rejected with 409, but this control shouldn't be able to
// construct one.
export function PaymentStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "PEND"
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

  const selected = PAYMENT_STATUS_CODES.find((s) => s.code === value);
  const nextCodes = PAYMENT_ALLOWED_TRANSITIONS[value] ?? [];
  const options = PAYMENT_STATUS_CODES.filter((s) => s.code === value || nextCodes.includes(s.code));
  const isTerminal = nextCodes.length === 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        onClick={() => !disabled && !isTerminal && setOpen((v) => !v)}
        disabled={disabled || isTerminal}
        className={`${fieldCls} flex items-center gap-2`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        {!isTerminal && <ChevronDown className="size-3 shrink-0 text-stone-400" />}
      </button>

      {open && !disabled && !isTerminal && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {options.map((s) => (
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
