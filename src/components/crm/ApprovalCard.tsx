import { Badge } from '@/components/tenant/ui';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved';

const cardCls = 'rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4';
const rowCls = 'flex justify-between items-center py-2 border-b border-stone-100 text-xs';

/** Sidebar card showing read-only approval state for a CRM record (status +
 *  assigned approver names). The actual Approve action lives in
 *  {@link ApprovalBanner}, shown above the tab bar when approval is pending. */
export function ApprovalCard({
  approverNames,
  status,
}: {
  approverNames: string[];
  status: ApprovalStatus;
}) {
  if (status === 'not_required') return null;

  return (
    <div className={cardCls}>
      <p className="text-xs font-semibold text-stone-400">Approval</p>

      <div className={rowCls}>
        <span className="text-stone-500">Status</span>
        {status === 'approved' ? (
          <Badge color="#22c55e">Approved</Badge>
        ) : (
          <Badge color="#f59e0b">Pending Approval</Badge>
        )}
      </div>

      <div className="py-1 text-xs space-y-1">
        <p className="text-stone-500">Approver(s)</p>
        <p className="font-medium text-stone-700">
          {approverNames.length > 0 ? approverNames.join(', ') : '—'}
        </p>
      </div>
    </div>
  );
}
