import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ShieldCheck, Check } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { resolveStatusOptions, isTerminalTarget, type StatusOption, type TransitionGuardResult } from '@/lib/statusTransitions';

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
  /** 'field' (default) fills its container, sized for a form row — this is the
   *  Edit page's control, unchanged. 'pill' renders a compact colored
   *  badge-button sized for a table cell or a Detail page sidebar row. */
  variant?: 'field' | 'pill';
  /** Per-status color for the pill's dot + background. Only used in 'pill'
   *  mode — the caller's existing `*_STATUS_COLORS` map, keyed by label. */
  colorFor?: (option: StatusOption) => string;
}

// One status <select> for every sales document. Behaviour that used to be
// copy-pasted (and drifted) across six controls now lives here: Escape-to-close,
// listbox/option ARIA, legal-transition filtering, and optional permission
// gating. Each document wires this up in a thin wrapper (e.g. InvoiceStatusControl).
//
// The 'pill' variant reuses all of the above for the List/Detail inline
// control — same transitions, same guard — but additionally arms a two-step
// confirm for any option that lands on a terminal status (no further legal
// moves): one click shows "Confirm: <label>", a second click on the same
// option commits it. This only applies in 'pill' mode; the Edit page's
// 'field' variant keeps firing on a single click, as it always has.
export function StatusSelect({
  value, onChange, disabled, statuses, allowedTransitions, guard, variant = 'field', colorFor,
}: Props) {
  const [open, setOpen] = useState(false);
  const [armedCode, setArmedCode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPill = variant === 'pill';

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setArmedCode(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setArmedCode(null); }
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
  const color = isPill ? (colorFor?.(selected ?? { code: value, label: value }) ?? '#a8a29e') : undefined;

  const triggerCls = isPill
    ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70'
    : `${fieldCls} flex items-center gap-2`;

  return (
    <div ref={containerRef} className={isPill ? 'relative inline-block' : 'relative w-full'}>
      {/* No aria-label: the visible label (e.g. "Draft") IS the accessible name.
          An aria-label would override it and cost screen-reader users the one
          thing this control reports — the current status. */}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => { if (!disabled && !isTerminal) { setOpen((v) => !v); setArmedCode(null); } }}
        disabled={disabled || isTerminal}
        className={triggerCls}
        style={isPill ? { backgroundColor: `${color}18` } : undefined}
      >
        {isPill && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
        <span className={isPill ? undefined : 'flex-1 text-left'}>{selected?.label ?? value}</span>
        {!isTerminal && <ChevronDown className={isPill ? 'size-3 shrink-0' : 'size-3 shrink-0 text-stone-400'} aria-hidden="true" />}
      </button>

      {open && !disabled && !isTerminal && (
        <div
          role="listbox"
          className={`absolute z-20 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md ${isPill ? 'left-0 w-56' : 'w-full'}`}
        >
          {options.map((s) => {
            const isCurrent = s.code === value;
            const verdict = guard && !isCurrent ? guard(s.code) : null;
            const permitted = isCurrent || !verdict || verdict.permitted;
            const reason = permitted ? null : verdict?.reason ?? null;
            const needsApprove = Boolean(verdict?.needsApprove);
            const terminalTarget = isPill && !isCurrent && isTerminalTarget(s.code, allowedTransitions);
            const armed = armedCode === s.code;
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
                onClick={() => {
                  if (!permitted) return;
                  if (terminalTarget && !armed) { setArmedCode(s.code); return; }
                  onChange(s.code);
                  setOpen(false);
                  setArmedCode(null);
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                  isCurrent
                    ? 'bg-brand/10 font-semibold text-stone-900'
                    : armed
                      ? 'bg-red-50 font-semibold text-red-700'
                      : permitted
                        ? 'text-stone-700 hover:bg-stone-50'
                        : 'text-stone-400 cursor-not-allowed'
                }`}
              >
                <span className="flex-1 text-left">{armed ? `Confirm: ${s.label}` : s.label}</span>
                {armed && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                {!armed && reason && (
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
