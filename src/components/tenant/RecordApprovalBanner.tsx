import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { RejectApprovalDialog } from '@/components/tenant/RejectApprovalDialog';
import type { ApprovalOverlay } from '@/types/tenant';

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
 *  reject(id, reason), `onRejected` receives the record it returns. */
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
          run={reject.run}
          onRejected={reject.onRejected}
          warning={reject.warning}
        />
      )}
    />
  );
}
