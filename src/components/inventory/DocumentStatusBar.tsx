import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  docStatusLabel, docTransitionLabel, APPROVAL_TARGET_STATUS,
} from '@/lib/inventoryDocumentStatus';

// Renders one confirm-gated button per legal transition target, sourced
// purely from the server's `nextStatuses` on the record's own GET (spec:
// "render buttons from that rather than hardcoding the machine" — every
// document here uses the same docflow.Machine().Next() shape). Mirrors
// PurchaseOrderTransitionBar's confirm-before-fire UX.
//
// The one exception to "purely server-driven" is display-only: a button
// targeting Approved is disabled with a tooltip unless the caller says
// `canApprove`, because the server itself gates that specific move behind
// the resource's separate `approve` grant — showing it enabled to someone
// without that grant would just trade a clear tooltip for a 403 toast.
export function DocumentStatusBar({
  statusCode, nextStatuses, onTransition, canTransition, canApprove, isPending,
}: {
  statusCode: string;
  nextStatuses: string[];
  onTransition: (toCode: string) => void;
  canTransition: boolean;
  canApprove: boolean;
  isPending?: boolean;
}) {
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  if (nextStatuses.length === 0 || !canTransition) return null;

  return (
    <div className="space-y-0.5">
      {nextStatuses.map((to) => {
        const needsApprove = to === APPROVAL_TARGET_STATUS;
        const blocked = needsApprove && !canApprove;
        const label = docTransitionLabel(statusCode, to);
        const isCancel = to === 'CANC';
        const isBackward = to === 'DRFT' || to === 'CNTG';
        const Icon = isCancel ? XCircle : isBackward ? RotateCcw : ArrowRight;
        return (
          <button
            key={to}
            type="button"
            onClick={() => setPendingTarget(to)}
            disabled={Boolean(isPending) || blocked}
            title={blocked ? 'Requires the approve permission.' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs w-full text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              isCancel
                ? 'text-destructive hover:bg-destructive/5'
                : isBackward
                  ? 'text-stone-600 hover:bg-stone-50'
                  : 'text-emerald-600 hover:bg-emerald-600/5',
            )}
          >
            {isPending && pendingTarget === to ? (
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
  const label = docTransitionLabel(fromCode, toCode);
  const isCancel = toCode === 'CANC';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', isCancel ? 'bg-destructive/10' : 'bg-accent')}>
            <AlertTriangle className={cn('size-4', isCancel ? 'text-destructive' : 'text-accent-foreground')} />
          </div>
          <div>
            <h3 id="doc-transition-confirm-title" className="text-sm font-bold text-stone-900">{label}?</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {docStatusLabel(fromCode)} → {docStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {isCancel
            ? 'This cancels the document. This action cannot be undone.'
            : `This will move the document to ${docStatusLabel(toCode)}.`}
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
