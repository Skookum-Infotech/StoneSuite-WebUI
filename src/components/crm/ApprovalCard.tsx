import { Badge } from '@/components/tenant/ui';
import type { CrmApprover } from '@/types/tenant';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

const cardCls = 'rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4';
const rowCls = 'flex justify-between items-center py-2 border-b border-stone-100 text-xs';

/** Sidebar card showing read-only approval state for a CRM record: status,
 *  quorum progress ("1 of 2 approved") when the stage requires more than one
 *  approver, and each configured approver's own sign-off. The actual
 *  Approve/Reject actions live in {@link ApprovalBanner}, shown above the tab
 *  bar while pending. */
export function ApprovalCard({
  approvers,
  status,
  rejectedByName,
  rejectionReason,
}: {
  /** Every approver configured for the record's stage, with their own
   *  sign-off state. Falls back to a plain name list (no per-approver ✓) if
   *  omitted, for callers that haven't loaded the full approval overlay. */
  approvers: CrmApprover[];
  status: ApprovalStatus;
  rejectedByName?: string;
  rejectionReason?: string;
}) {
  if (status === 'not_required') return null;

  const approvedCount = approvers.filter((a) => a.approved).length;
  const showsProgress = status === 'pending' && approvers.length > 1;

  return (
    <div className={cardCls}>
      <p className="type-card-title">Approval</p>

      <div className={rowCls}>
        <span className="text-ink-muted">Status</span>
        {status === 'approved' ? (
          <Badge color="#22c55e">Approved</Badge>
        ) : status === 'rejected' ? (
          <Badge color="#ef4444">Rejected</Badge>
        ) : (
          <Badge color="#f59e0b">
            {showsProgress ? `Pending (${approvedCount} of ${approvers.length})` : 'Pending Approval'}
          </Badge>
        )}
      </div>

      <div className="py-1 text-xs space-y-1.5">
        <p className="text-ink-muted">Approver(s)</p>
        {approvers.length > 0 ? (
          <ul className="space-y-1">
            {approvers.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{a.name}</span>
                {a.approved && <span className="text-micro font-semibold text-success-ink">Signed off</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-medium text-ink">—</p>
        )}
      </div>

      {status === 'rejected' && (
        <div className="py-1 text-xs space-y-1 border-t border-stone-100 pt-2">
          <p className="text-ink-muted">Rejected by</p>
          <p className="font-medium text-ink">{rejectedByName || 'Unknown'}</p>
          {rejectionReason && (
            <>
              <p className="text-ink-muted pt-1">Reason</p>
              <p className="font-medium text-ink">{rejectionReason}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
