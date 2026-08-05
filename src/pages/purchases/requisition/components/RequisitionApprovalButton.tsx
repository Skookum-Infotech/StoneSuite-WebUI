import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { requisitionService } from '@/services/requisitionService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { Requisition } from '@/types/requisition';

// Records this user's approval sign-off (POST /requisitions/{id}/approve).
// Shown only while approvalStatus === 'pending' — mirrors
// PurchaseOrderApprovalButton. A caller who isn't a configured approver for
// the requisition's current status gets 403 (ErrNotApprover), surfaced as the
// error message below.
export function RequisitionApprovalButton({ requisitionId, onApproved }: {
  requisitionId: string;
  onApproved: (updated: Requisition) => void;
}) {
  const approve = useMutation({
    mutationFn: () => requisitionService.approve(requisitionId),
    onSuccess: onApproved,
  });

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => approve.mutate()}
        disabled={approve.isPending}
        aria-label="Approve this requisition"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
      >
        {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        {approve.isPending ? 'Approving…' : 'Approve'}
      </button>
      {approve.error && (
        <p className="text-2xs text-destructive">{apiErrorMessage(approve.error, 'Failed to approve requisition.')}</p>
      )}
    </div>
  );
}
