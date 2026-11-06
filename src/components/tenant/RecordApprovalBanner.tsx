import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { RejectApprovalDialog } from '@/components/tenant/RejectApprovalDialog';
import { APPROVALS_INBOX_KEY } from '@/hooks/useApprovalInboxSummary';
import type { ApprovalOverlay } from '@/types/tenant';

// The KPI strip's query key (DashboardPage), which carries the Needs Approval tile.
const KPI_STRIP_KEY = 'dashboard-kpi-strip';

/** The approval banner every Sales/Purchases detail page shows under its
 *  header: hand it the record (each module's record type carries the
 *  approval overlay fields) and it picks the right state --
 *   - nothing, once the record is neither awaiting approval nor rejected;
 *   - the amber pending banner, with Approve, and Reject beside it for a
 *     configured approver or Super Admin (`record.canReject`, when the page
 *     supplies `reject`);
 *   - the red rejected banner (who and why) for a record an approver
 *     rejected -- whether it was sent back to Draft (not gated any more) or
 *     flagged rejected in place (still gated, so its status stays locked).
 *
 *  `reject` is the page's Reject wiring: `run` is the module service's
 *  reject(id, reason), `onRejected` receives the record it returns.
 *
 *  Approving or rejecting changes what the Approvals inbox, its sidebar badge
 *  and the dashboard's Needs Approval tile show, so the banner invalidates
 *  those itself -- every detail page gets it without wiring it. */
export function RecordApprovalBanner<T>({ record, onApprove, approving, reject, resubmitVia }: {
  record: ApprovalOverlay;
  onApprove: () => void;
  approving?: boolean;
  reject?: {
    noun: string;
    run: (reason: string) => Promise<T>;
    onRejected: (updated: T) => void;
    warning?: string;
  };
  /** 'submit' for a record a Reject sends back to Draft, 'edit' (the default)
   *  for one flagged rejected in place. */
  resubmitVia?: 'edit' | 'submit';
}) {
  const queryClient = useQueryClient();

  function invalidateApprovalQueries() {
    void queryClient.invalidateQueries({ queryKey: [APPROVALS_INBOX_KEY] });
    void queryClient.invalidateQueries({ queryKey: [KPI_STRIP_KEY] });
  }

  // The page owns the approve mutation; its pending flag falling back to false
  // is the banner's only signal that the call settled.
  const wasApproving = useRef(false);
  useEffect(() => {
    if (wasApproving.current && !approving) invalidateApprovalQueries();
    wasApproving.current = Boolean(approving);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invalidate only on the approving edge
  }, [approving]);

  if (record.rejection) {
    return (
      <ApprovalBanner
        status="rejected"
        rejection={record.rejection}
        resubmitVia={resubmitVia}
        approverNames={[]}
        canApprove={false}
        onApprove={onApprove}
      />
    );
  }
  if (!record.gated) return null;

  return (
    <ApprovalBanner
      approverNames={record.approvers.filter((a) => !a.approved).map((a) => a.name)}
      canApprove={record.canApprove}
      isOverride={record.isOverride}
      requiredApprovals={record.requiredApprovals}
      approvedCount={record.approvedCount}
      callerAlreadyApproved={record.callerAlreadyApproved}
      onApprove={onApprove}
      approving={approving}
      actions={record.canReject && reject && (
        <RejectApprovalDialog
          noun={reject.noun}
          run={(reason) => reject.run(reason).then((updated) => {
            invalidateApprovalQueries();
            return updated;
          })}
          onRejected={reject.onRejected}
          warning={reject.warning}
        />
      )}
    />
  );
}
