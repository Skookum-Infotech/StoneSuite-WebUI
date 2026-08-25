import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRight, CalendarClock, Loader2, RotateCcw, ShieldCheck, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  vpTransitionTargets, vpTransitionLabel, vpStatusLabel, isVpTransitionBlocked, isScheduleBlocked,
} from '@/lib/vendorPaymentForm';

// Renders one button per legal transition target from the payment's current
// status — mirrors VendorBillTransitionBar. Two gates beyond the bill's:
//   * PAPV→APPV is filtered out entirely (vpTransitionTargets) — the generic
//     /transition endpoint rejects it with 409; only the /approve sign-off
//     crosses that edge, and the Detail page renders
//     VendorPaymentApprovalButton alongside this for exactly that.
//   * APPV→SCHD is disabled without a scheduled date on the header, which the
//     server requires (400) and the transition body has no field for — it has
//     to be saved through Edit first.
//
// Every transition is confirmed before it fires — voiding a payment cascades
// an unapply across every bill it settled, so a misclick in a row of buttons
// should not reach the server.
export function VendorPaymentTransitionBar({
  statusCode, approvalStatus, gated, scheduledDate, onTransition, isPending,
}: {
  statusCode: string;
  approvalStatus: string;
  gated?: boolean;
  scheduledDate?: string | null;
  onTransition: (toCode: string) => void;
  isPending: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const canTransition = isLoading || hasPermission('vendor_payment', 'transition');
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const targets = vpTransitionTargets(statusCode);
  if (targets.length === 0 || !canTransition) return null;

  return (
    <div className="space-y-0.5">
      {targets.map((toCode) => {
        const label = vpTransitionLabel(statusCode, toCode);
        const approvalBlocked = isVpTransitionBlocked(toCode, approvalStatus, gated);
        const scheduleBlocked = isScheduleBlocked(toCode, scheduledDate);
        const blocked = approvalBlocked || scheduleBlocked;
        const isVoid = toCode === 'VOID';
        const isRework = toCode === 'DRFT';
        const isSchedule = toCode === 'SCHD';
        const Icon = isVoid ? XCircle : isRework ? RotateCcw : isSchedule ? CalendarClock : ArrowRight;
        return (
          <button
            key={toCode}
            type="button"
            onClick={() => setPendingTarget(toCode)}
            disabled={isPending || blocked}
            title={
              approvalBlocked ? 'Awaiting approval sign-off'
                : scheduleBlocked ? 'Set a scheduled date on the payment first'
                  : undefined
            }
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs w-full text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              isVoid
                ? 'text-destructive hover:bg-destructive/5'
                : isRework
                  ? 'text-stone-600 hover:bg-stone-50'
                  : 'text-emerald-600 hover:bg-emerald-600/5',
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : approvalBlocked ? (
              <ShieldCheck className="size-4 shrink-0" />
            ) : (
              <Icon className="size-4 shrink-0" />
            )}
            {label}
          </button>
        );
      })}

      {pendingTarget && (
        <TransitionConfirmDialog
          fromCode={statusCode}
          toCode={pendingTarget}
          onCancel={() => setPendingTarget(null)}
          onConfirm={() => {
            onTransition(pendingTarget);
            setPendingTarget(null);
          }}
        />
      )}
    </div>
  );
}

function TransitionConfirmDialog({ fromCode, toCode, onCancel, onConfirm }: {
  fromCode: string;
  toCode: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const contentRef = useModalDialog(onCancel);
  const label = vpTransitionLabel(fromCode, toCode);
  const isVoid = toCode === 'VOID';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', isVoid ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', isVoid ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <div>
            <h3 id="vp-transition-confirm-title" className="text-sm font-bold text-stone-900">
              {label}?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {vpStatusLabel(fromCode)} → {vpStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {isVoid
            ? 'This voids the vendor payment and reverses every application it holds, restoring the balance due on each bill it settled. This action cannot be undone.'
            : `This will move the vendor payment to ${vpStatusLabel(toCode)}.`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all',
              isVoid
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-brand text-stone-950 hover:bg-brand-hover',
            )}
          >
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
