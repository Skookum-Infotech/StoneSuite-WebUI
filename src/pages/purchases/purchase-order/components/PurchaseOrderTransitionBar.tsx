import { Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  PO_ALLOWED_TRANSITIONS, poTransitionLabel, isPoTransitionBlocked,
} from '@/lib/purchaseOrderForm';

// Renders one button per legal transition target from the PO's current
// status (spec §2's state-machine table) — unlike Estimate/Fabrication's
// single StatusSelect dropdown, the handoff spec calls for a labeled action
// row ("Submit for Approval", "Send to Vendor", "Short-Close", …) since each
// target has a distinct business meaning rather than being one of many peer
// options in a picklist. PAPV→APPV (or any non-DRFT move while approval is
// pending) is disabled with a tooltip; the Detail page renders
// PurchaseOrderApprovalButton alongside this to actually clear that gate.
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
            onClick={() => onTransition(toCode)}
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
    </div>
  );
}
