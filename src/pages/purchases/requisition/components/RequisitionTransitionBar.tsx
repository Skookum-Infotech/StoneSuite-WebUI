import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  REQUISITION_ALLOWED_TRANSITIONS, reqnTransitionLabel, reqnStatusLabel, isReqnTransitionBlocked,
} from '@/lib/requisitionForm';

// Renders one button per legal transition target from the requisition's
// current status — mirrors PurchaseOrderTransitionBar. Each target has a
// distinct business meaning ("Submit for Approval", "Recall to Draft",
// "Revise", "Cancel") rather than being one of many peer options, so this is a
// labeled action row rather than a status picklist.
//
// Any non-DRFT move while approval is pending is disabled with a tooltip; the
// Detail page renders RequisitionApprovalButton alongside this to clear that
// gate. When no approvers are configured for the current status the server
// reports approvalStatus 'none', nothing is gated, and the approval button is
// absent entirely — the ordinary case until requisition approvers can be
// configured.
//
// Every transition is confirmed before it fires — clicking the wrong button in
// a row of several should be recoverable without an accidental round-trip.
export function RequisitionTransitionBar({
  statusCode, approvalStatus, onTransition, isPending,
}: {
  statusCode: string;
  approvalStatus: string;
  onTransition: (toCode: string) => void;
  isPending: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const canTransition = isLoading || hasPermission('requisition', 'transition');
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const targets = REQUISITION_ALLOWED_TRANSITIONS[statusCode] ?? [];
  if (targets.length === 0 || !canTransition) return null;

  return (
    <div className="space-y-0.5">
      {targets.map((toCode) => {
        const label = reqnTransitionLabel(statusCode, toCode);
        const blocked = isReqnTransitionBlocked(toCode, approvalStatus);
        const isCancel = toCode === 'CANC';
        const isRework = toCode === 'DRFT';
        const Icon = isCancel ? XCircle : isRework ? RotateCcw : ArrowRight;
        return (
          <button
            key={toCode}
            type="button"
            onClick={() => setPendingTarget(toCode)}
            disabled={isPending || blocked}
            title={blocked ? 'Awaiting approval sign-off' : undefined}
            aria-label={label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs w-full text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              isCancel
                ? 'text-destructive hover:bg-destructive/5'
                : isRework
                  ? 'text-stone-600 hover:bg-stone-50'
                  : 'text-emerald-600 hover:bg-emerald-600/5',
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : blocked ? (
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
  const label = reqnTransitionLabel(fromCode, toCode);
  const isCancel = toCode === 'CANC';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqn-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', isCancel ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', isCancel ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <div>
            <h3 id="reqn-transition-confirm-title" className="text-sm font-bold text-stone-900">
              {label}?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {reqnStatusLabel(fromCode)} → {reqnStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {isCancel
            ? 'This cancels the requisition. This action cannot be undone.'
            : `This will move the requisition to ${reqnStatusLabel(toCode)}.`}
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
              isCancel
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
