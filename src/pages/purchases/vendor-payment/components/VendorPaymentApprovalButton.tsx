import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { VendorPayment } from '@/types/vendorPayment';

// Records this user's approval sign-off (POST /vendor-payments/{id}/approve).
// Shown only while approvalStatus === 'pending' (AD-6) — mirrors
// VendorBillApprovalButton. There is no separate "approve" permission: this
// rides on vendor_payment:transition, the same grant that gates
// VendorPaymentTransitionBar. A caller who isn't a configured approver for the
// payment's current status gets 403 (ErrNotApprover), surfaced below.
//
// Unlike the bill's button, this one can also advance the record: when the
// sign-off completes the configured quorum while the payment sits at PAPV, the
// backend moves it to APPV in the same transaction — the only path across that
// edge — so callers must refresh from the returned payment, not assume the
// status is unchanged.
export function VendorPaymentApprovalButton({ vendorPaymentId, onApproved }: {
  vendorPaymentId: string;
  onApproved: (updated: VendorPayment) => void;
}) {
  const approve = useMutation({
    mutationFn: () => vendorPaymentService.approve(vendorPaymentId),
    onSuccess: onApproved,
  });

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => approve.mutate()}
        disabled={approve.isPending}
        aria-label="Record my approval of this vendor payment"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
      >
        {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        {approve.isPending ? 'Approving…' : 'Approve'}
      </button>
      {approve.error && (
        <p role="alert" className="text-2xs text-destructive">
          {apiErrorMessage(approve.error, 'Failed to approve vendor payment.')}
        </p>
      )}
    </div>
  );
}
