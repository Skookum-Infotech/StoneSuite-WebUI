import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { PurchaseOrder } from '@/types/purchaseOrder';

// Records this user's approval sign-off (POST /purchase-orders/{id}/approve).
// Shown only while approvalStatus === 'pending' (AD-6) — mirrors
// QuoteApprovalButton/FabricationApprovalButton. A caller who isn't a
// configured approver for the PO's current status gets 403 (ErrNotApprover),
// surfaced as the error message below.
export function PurchaseOrderApprovalButton({ purchaseOrderId, onApproved }: {
  purchaseOrderId: string;
  onApproved: (updated: PurchaseOrder) => void;
}) {
  const approve = useMutation({
    mutationFn: () => purchaseOrderService.approve(purchaseOrderId),
    onSuccess: onApproved,
  });

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => approve.mutate()}
        disabled={approve.isPending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
      >
        {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        {approve.isPending ? 'Approving…' : 'Approve'}
      </button>
      {approve.error && (
        <p className="text-2xs text-destructive">{apiErrorMessage(approve.error, 'Failed to approve purchase order.')}</p>
      )}
    </div>
  );
}
