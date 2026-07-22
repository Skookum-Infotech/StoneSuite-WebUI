import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { FabricationJob } from '@/types/fabrication';

// Records this user's approval sign-off (POST /fabrication-jobs/{id}/approve).
// Shown only while approvalStatus === 'pending' — see fabricationForm's
// needsApproval doc: whether the job's *current* status even has a gate is
// configured per-tenant server-side, so this button's visibility is entirely
// data-driven off the job's own approvalStatus, never a hardcoded status
// check. A caller who isn't a configured approver for this status gets 403
// (ErrNotApprover), surfaced as the error message below.
export function FabricationApprovalButton({ jobId, onApproved }: {
  jobId: string;
  onApproved: (updated: FabricationJob) => void;
}) {
  const approve = useMutation({
    mutationFn: () => fabricationService.approve(jobId),
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
        <p className="text-2xs text-destructive">{apiErrorMessage(approve.error, 'Failed to approve fabrication job.')}</p>
      )}
    </div>
  );
}
