import { AlarmClock, CheckCircle2, CircleDashed, Loader2, type LucideIcon } from 'lucide-react';
import { isVbTransitionBlocked, vbHeaderTransitions, vbTransitionLabel } from '@/lib/vendorBillForm';

const BLOCKED_REASON = 'Awaiting approval sign-off';
const MARK_PREFIX = 'Mark ';

const BASE_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// One look per settlement status, so a button previews the status it applies:
// amber for partly settled, red for late, and solid green for the final Paid.
const TONES: Record<string, { icon: LucideIcon; className: string }> = {
  ODUE: { icon: AlarmClock, className: 'border-red-200 bg-white text-red-700 hover:bg-red-50' },
  PART: { icon: CircleDashed, className: 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50' },
  PAID: { icon: CheckCircle2, className: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' },
};
// A header move added to vendorBillForm without a tone here still renders.
const NEUTRAL_TONE = { icon: CheckCircle2, className: 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50' };

// The Vendor Bill Detail page's header buttons: Mark Overdue, Mark Partially
// Paid and Mark Paid, each shown only when that move is legal from the bill's
// current status. Void is deliberately not here — it is a Danger Zone button at
// the bottom of the page — and the approval moves stay in the sidebar pill.
// Rendered as a fragment so the buttons are direct children of CrmPageHeader's
// actions wrapper (its mobile sizing targets them); on a phone the "Mark "
// prefix drops out so three buttons still fit.
export function VendorBillHeaderActions({ order, canTransition, onTransition, pendingCode }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean; nextStatusCodes?: string[] };
  canTransition: boolean;
  /** Asked for a move; the page decides whether to confirm it first. */
  onTransition: (code: string) => void;
  /** The move currently in flight, if any — it shows a spinner and every
   *  button is disabled until it settles. */
  pendingCode?: string;
}) {
  const codes = canTransition ? vbHeaderTransitions(order) : [];

  return (
    <>
      {codes.map((code) => {
        const label = vbTransitionLabel(order.statusCode, code);
        const blocked = isVbTransitionBlocked(code, order.approvalStatus, order.gated);
        const { icon: Icon, className } = TONES[code] ?? NEUTRAL_TONE;
        const short = label.startsWith(MARK_PREFIX) ? label.slice(MARK_PREFIX.length) : label;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onTransition(code)}
            disabled={blocked || pendingCode !== undefined}
            title={blocked ? BLOCKED_REASON : undefined}
            aria-label={label}
            className={`${BASE_BTN} ${className}`}
          >
            {pendingCode === code
              ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              : <Icon className="size-3.5" aria-hidden="true" />}
            <span aria-hidden="true">
              {short !== label && <span className="hidden sm:inline">{MARK_PREFIX}</span>}
              {short}
            </span>
          </button>
        );
      })}
    </>
  );
}
