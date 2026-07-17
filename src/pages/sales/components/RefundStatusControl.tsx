import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { REFUND_STATUS_CODES, REFUND_ALLOWED_TRANSITIONS, transitionPermission } from '@/lib/refundForm';

// Status select for the Refund Edit page. Like PaymentStatusControl, Refund's
// transitions branch (PEND -> APPV|VOID, APPV -> SENT|VOID; SENT and VOID
// terminal), so this offers the current status plus its legal next-moves only.
//
// What's different from every other status control in this family: Refund
// splits its transitions across *two* permissions (spec AD-4). Approving is
// what authorizes the refund to draw down real money, so PEND -> APPV needs
// `refund:approve` while every other move needs `refund:transition`. A user
// holding transition-but-not-approve (the `customer_support` role, spec §12)
// can void a draft but cannot approve one — so this control disables, rather
// than hides, the moves they lack, and says why. Hiding would make an
// unavailable step look nonexistent.
//
// The backend (refund.Transition + actionForTransition) stays authoritative:
// an illegal move is a 409 and a permission-less one a 403. This control just
// shouldn't be able to construct either.
export function RefundStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "PEND"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  // Permissive while loading, matching every other detail/edit surface here.
  const allows = (code: string) =>
    permissionsLoading || hasPermission('refund', transitionPermission(code));

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

  const selected = REFUND_STATUS_CODES.find((s) => s.code === value);
  const nextCodes = REFUND_ALLOWED_TRANSITIONS[value] ?? [];
  const options = REFUND_STATUS_CODES.filter((s) => s.code === value || nextCodes.includes(s.code));
  const isTerminal = nextCodes.length === 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* No aria-label here: the visible label ("Pending") IS the accessible
          name. An aria-label would override it and cost screen-reader users
          the one thing this control reports — the current status. */}
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
            const permitted = isCurrent || allows(s.code);
            const needsApprove = !permitted && transitionPermission(s.code) === 'approve';
            const reason = permitted
              ? null
              : needsApprove
                ? 'Needs the approve permission'
                : 'You do not have permission for this change';
            return (
              // aria-disabled, not the `disabled` attribute: a disabled button
              // leaves the tab order, which would hide the very explanation
              // this option exists to give — a support user needs to see that
              // Approve is a real step someone else can take, not that it
              // doesn't exist. The click is guarded on `permitted` instead.
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
