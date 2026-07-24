import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  PO_ALLOWED_TRANSITIONS, poTransitionLabel, poStatusLabel, isPoTransitionBlocked,
} from '@/lib/purchaseOrderForm';

// Renders one button per legal transition target from the PO's current
// status (spec §2's state-machine table) — unlike Estimate/Fabrication's
// single StatusSelect dropdown, the handoff spec calls for a labeled action
// row ("Submit for Approval", "Send to Vendor", "Short-Close", …) since each
// target has a distinct business meaning rather than being one of many peer
// options in a picklist. PAPV→APPV (or any non-DRFT move while approval is
// pending) is disabled with a tooltip; the Detail page renders
// PurchaseOrderApprovalButton alongside this to actually clear that gate.
//
// Every transition is confirmed before it fires — a PO status change is
// often a real-world commitment (submitting for approval, sending to a
// vendor, cancelling) and clicking the wrong button in a row of several
// should be recoverable without an accidental server round-trip.
export function PurchaseOrderTransitionBar({
  statusCode, approvalStatus, onTransition, isPending,
}: {
  statusCode: string;
  approvalStatus: string;
  onTransition: (toCode: string) => void;
  isPending: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const canTransition = isLoading || hasPermission('purchase_order', 'transition');
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const targets = PO_ALLOWED_TRANSITIONS[statusCode] ?? [];
  if (targets.length === 0 || !canTransition) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets.map((toCode) => {
        const label = poTransitionLabel(statusCode, toCode);
        const blocked = isPoTransitionBlocked(toCode, approvalStatus);
        const isCancel = toCode === 'CANC';
        const isRework = toCode === 'DRFT';
        return (
          <button
            key={toCode}
            type="button"
            onClick={() => setPendingTarget(toCode)}
            disabled={isPending || blocked}
            title={blocked ? 'Awaiting approval sign-off' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              isCancel
                ? 'border border-destructive/30 text-destructive hover:bg-destructive/5'
                : isRework
                  ? 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  : 'bg-brand text-stone-950 hover:bg-brand-hover shadow-sm',
            )}
          >
            {isPending ? <Loader2 className="size-3 animate-spin" /> : blocked && <ShieldCheck className="size-3" />}
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
  const label = poTransitionLabel(fromCode, toCode);
  const isCancel = toCode === 'CANC';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="po-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', isCancel ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', isCancel ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <div>
            <h3 id="po-transition-confirm-title" className="text-sm font-bold text-stone-900">
              {label}?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {poStatusLabel(fromCode)} → {poStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {isCancel
            ? 'This cancels the purchase order. This action cannot be undone.'
            : `This will move the purchase order to ${poStatusLabel(toCode)}.`}
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
