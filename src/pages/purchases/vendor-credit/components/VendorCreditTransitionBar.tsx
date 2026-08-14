import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  VC_ALLOWED_TRANSITIONS, vcTransitionLabel, vcStatusLabel, transitionPermission,
} from '@/lib/vendorCreditForm';

// Renders one button per legal transition target from the credit's current
// status — mirrors VendorBillTransitionBar. Unlike Vendor Bill/Vendor Payment
// (one blanket `:transition` permission gates the whole bar, with a separate
// approval-quorum concept), Vendor Credit splits its two moves across *two*
// permissions on the same generic endpoint (backend AD-2): DRFT->APPV needs
// `vendor_credit:approve`, every other move needs `vendor_credit:transition`.
// So each button is gated individually via transitionPermission(toCode),
// mirroring RefundStatusControl's guard — disabled (not hidden) when the
// caller lacks the specific permission, so the UI explains why rather than
// silently omitting the option.
//
// Every transition is confirmed before it fires — voiding a credit cascades
// a reversal across every bill it funded, so a misclick in a row of buttons
// should not reach the server.
export function VendorCreditTransitionBar({
  statusCode, onTransition, isPending,
}: {
  statusCode: string;
  onTransition: (toCode: string) => void;
  isPending: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const targets = VC_ALLOWED_TRANSITIONS[statusCode] ?? [];
  if (targets.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {targets.map((toCode) => {
        const label = vcTransitionLabel(statusCode, toCode);
        const perm = transitionPermission(toCode);
        const permitted = isLoading || hasPermission('vendor_credit', perm);
        const isVoid = toCode === 'VOID';
        const Icon = isVoid ? XCircle : ArrowRight;
        return (
          <button
            key={toCode}
            type="button"
            onClick={() => setPendingTarget(toCode)}
            disabled={isPending || !permitted}
            title={!permitted ? `Needs the ${perm} permission` : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs w-full text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              isVoid
                ? 'text-destructive hover:bg-destructive/5'
                : 'text-emerald-600 hover:bg-emerald-600/5',
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : !permitted ? (
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
  const label = vcTransitionLabel(fromCode, toCode);
  const isVoid = toCode === 'VOID';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vc-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', isVoid ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', isVoid ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <div>
            <h3 id="vc-transition-confirm-title" className="text-sm font-bold text-stone-900">
              {label}?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {vcStatusLabel(fromCode)} → {vcStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {isVoid
            ? 'This voids the vendor credit and reverses every application it holds, restoring the balance due on each bill it funded. This action cannot be undone.'
            : `This will move the vendor credit to ${vcStatusLabel(toCode)}.`}
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
