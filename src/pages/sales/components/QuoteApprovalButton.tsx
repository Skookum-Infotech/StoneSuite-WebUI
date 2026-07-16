import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { Quote } from '@/types/quote';

// Records this user's approval sign-off (POST /quotes/{id}/approve). Shown
// by the Edit and Detail pages only while statusCode === QUOTE_APPROVAL_
// PENDING_STATUS — see quoteForm.ts's doc and plan Decision #4. Unlike a
// normal status transition, approval has no "toStatusCode" to pick; it's a
// single action.
export function QuoteApprovalButton({ quoteId, onApproved }: {
  quoteId: string;
  onApproved: (updated: Quote) => void;
}) {
  const approve = useMutation({
    mutationFn: () => quoteService.approve(quoteId),
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
        {approve.isPending ? 'Approving…' : 'Approve Quote'}
      </button>
      {approve.error && (
        <p className="text-2xs text-destructive">{apiErrorMessage(approve.error, 'Failed to approve quote.')}</p>
      )}
    </div>
  );
}
