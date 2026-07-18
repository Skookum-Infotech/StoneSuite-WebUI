import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { resolveStatusOptions, type StatusOption, type TransitionGuardResult } from '@/lib/statusTransitions';

interface Props {
  /** Current status code, e.g. "DRFT". */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  statuses: StatusOption[];
  /** Legal next-moves per status, mirroring the backend `<doc>/transitions.go`
   *  allowedTransitions map. When provided, the control offers only the current
   *  status plus its legal moves and disables entirely at a terminal status.
   *  When omitted, the whole catalog is offered and it is never terminal. */
  allowedTransitions?: Record<string, string[]>;
  /** Per-target permission check. When omitted, every move is permitted (the
   *  backend still enforces its own RBAC — a 403 surfaces as a save error). */
  guard?: (code: string) => TransitionGuardResult;
}

// One status <select> for every sales document. Behaviour that used to be
// copy-pasted (and drifted) across six controls now lives here: Escape-to-close,
// listbox/option ARIA, legal-transition filtering, and optional permission
// gating. Each document wires this up in a thin wrapper (e.g. InvoiceStatusControl).
export function StatusSelect({ value, onChange, disabled, statuses, allowedTransitions, guard }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selected = statuses.find((s) => s.code === value);
  const { options, isTerminal } = resolveStatusOptions(statuses, value, allowedTransitions);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* No aria-label: the visible label (e.g. "Draft") IS the accessible name.
          An aria-label would override it and cost screen-reader users the one
          thing this control reports — the current status. */}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && !isTerminal && setOpen((v) => !v)}
        disabled={disabled || isTerminal}
        className={`${fieldCls} flex items-center gap-2`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        {!isTerminal && <ChevronDown className="size-3 shrink-0 text-stone-400" aria-hidden="true" />}
      </button>

      {open && !disabled && !isTerminal && (
        <div role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {options.map((s) => {
            const isCurrent = s.code === value;
            const verdict = guard && !isCurrent ? guard(s.code) : null;
            const permitted = isCurrent || !verdict || verdict.permitted;
            const reason = permitted ? null : verdict?.reason ?? null;
            const needsApprove = Boolean(verdict?.needsApprove);
            return (
              // aria-disabled, not the `disabled` attribute: a disabled button
              // leaves the tab order, which would hide the very explanation this
              // option exists to give. The click is guarded on `permitted`.
              <button
                key={s.code}
                type="button"
                role="option"
                aria-selected={isCurrent}
                aria-disabled={!permitted}
                onClick={() => { if (permitted) { onChange(s.code); setOpen(false); } }}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                  isCurrent
                    ? 'bg-brand/10 font-semibold text-stone-900'
                    : permitted
                      ? 'text-stone-700 hover:bg-stone-50'
                      : 'text-stone-400 cursor-not-allowed'
                }`}
              >
                <span className="flex-1 text-left">{s.label}</span>
                {reason && (
                  <span className="flex shrink-0 items-center gap-1 text-2xs text-stone-400">
                    {needsApprove && <ShieldCheck className="size-3 shrink-0" aria-hidden="true" />}
                    {reason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
