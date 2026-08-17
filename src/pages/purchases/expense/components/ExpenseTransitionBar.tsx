import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useModalDialog } from '@/hooks/useModalDialog';
import {
  EXPENSE_ALLOWED_TRANSITIONS, expTransitionLabel, expStatusLabel, isExpTransitionBlocked,
} from '@/lib/expenseForm';

// Renders one button per legal transition target from the claim's current
// status via the generic transition endpoint — mirrors
// RequisitionTransitionBar. There is no Cancel/terminal-reject target here:
// RJCT is never reachable through this bar (spec AD-5 — rejection is always
// a dedicated action, rendered separately by RejectExpenseDialog on the
// Detail page).
//
// Any non-DRFT move while approval is pending is disabled with a tooltip; the
// Detail page renders ExpenseApprovalButton alongside this to clear that
// gate. When no approvers are configured for the current status the server
// reports approvalStatus 'none', nothing is gated, and the approval button is
// absent entirely — the ordinary case until expense approvers can be
// configured.
//
// Every transition is confirmed before it fires — clicking the wrong button in
// a row of several should be recoverable without an accidental round-trip.
export function ExpenseTransitionBar({
  statusCode, approvalStatus, onTransition, isPending,
}: {
  statusCode: string;
  approvalStatus: string;
  onTransition: (toCode: string) => void;
  isPending: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const canTransition = isLoading || hasPermission('expense', 'transition');
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const targets = EXPENSE_ALLOWED_TRANSITIONS[statusCode] ?? [];
  if (targets.length === 0 || !canTransition) return null;

  return (
    <div className="space-y-0.5">
      {targets.map((toCode) => {
        const label = expTransitionLabel(statusCode, toCode);
        const blocked = isExpTransitionBlocked(toCode, approvalStatus);
        const isRework = toCode === 'DRFT';
        const Icon = isRework ? RotateCcw : ArrowRight;
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
              isRework
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
  const label = expTransitionLabel(fromCode, toCode);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exp-transition-confirm-title"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <AlertTriangle className="size-4 text-accent-foreground" />
          </div>
          <div>
            <h3 id="exp-transition-confirm-title" className="text-sm font-bold text-stone-900">
              {label}?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {expStatusLabel(fromCode)} → {expStatusLabel(toCode)}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-5">
          {`This will move the expense claim to ${expStatusLabel(toCode)}.`}
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
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm active:scale-95 transition-all bg-brand text-stone-950 hover:bg-brand-hover"
          >
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
