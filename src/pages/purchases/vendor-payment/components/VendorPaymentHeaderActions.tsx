import { CalendarClock, CheckCheck, Loader2, RotateCcw, Send, type LucideIcon } from 'lucide-react';
import {
  isScheduleBlocked, isVpTransitionBlocked, vpHeaderTransitions, vpTransitionLabel,
} from '@/lib/vendorPaymentForm';

const APPROVAL_BLOCKED_REASON = 'Awaiting approval sign-off';
const SCHEDULE_BLOCKED_REASON = 'Set a scheduled date first';

const BASE_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// One look per target status, so a button previews the move it performs.
const TONES: Record<string, { icon: LucideIcon; className: string }> = {
  PAPV: { icon: Send, className: 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50' },
  DRFT: { icon: RotateCcw, className: 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50' },
  SCHD: { icon: CalendarClock, className: 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50' },
  SENT: { icon: CheckCheck, className: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' },
};
const NEUTRAL_TONE = { icon: CheckCheck, className: 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50' };

// The Vendor Payment Detail page's header buttons: one per legal move from the
// payment's current status (Submit for Approval, Recall to Draft, Schedule
// Payment, Mark Sent). Void is deliberately not here — it is a confirmed
// Danger Zone button — and PAPV->APPV never appears: only the approval banner's
// sign-off crosses it. Rendered as a fragment so the buttons are direct
// children of CrmPageHeader's actions wrapper.
export function VendorPaymentHeaderActions({ order, canTransition, onTransition, pendingCode }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean; scheduledDate?: string | null; nextStatusCodes?: string[] };
  canTransition: boolean;
  onTransition: (code: string) => void;
  /** The move currently in flight — shows a spinner and disables every button. */
  pendingCode?: string;
}) {
  const codes = canTransition ? vpHeaderTransitions(order) : [];

  return (
    <>
      {codes.map((code) => {
        const label = vpTransitionLabel(order.statusCode, code);
        const approvalBlocked = isVpTransitionBlocked(code, order.approvalStatus, order.gated);
        const scheduleBlocked = isScheduleBlocked(code, order.scheduledDate);
        const reason = approvalBlocked ? APPROVAL_BLOCKED_REASON : scheduleBlocked ? SCHEDULE_BLOCKED_REASON : undefined;
        const { icon: Icon, className } = TONES[code] ?? NEUTRAL_TONE;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onTransition(code)}
            disabled={Boolean(reason) || pendingCode !== undefined}
            title={reason}
            aria-label={label}
            className={`${BASE_BTN} ${className}`}
          >
            {pendingCode === code
              ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              : <Icon className="size-3.5" aria-hidden="true" />}
            <span aria-hidden="true">{label}</span>
          </button>
        );
      })}
    </>
  );
}
