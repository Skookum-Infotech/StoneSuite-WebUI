import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/tenant/ui';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved';

const UNAUTHORIZED_APPROVE_MESSAGE =
  'You are not authorized to approve this document. Only the assigned approver(s) can approve it.';

const cardCls = 'rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4';
const rowCls = 'flex justify-between items-center py-2 border-b border-stone-100 text-xs';

/** Sidebar card showing approval state for a CRM record and, when the
 *  logged-in user is an assigned approver, the action to approve it. */
export function ApprovalCard({
  approverNames,
  status,
  canApprove,
  onApprove,
  approving,
}: {
  approverNames: string[];
  status: ApprovalStatus;
  canApprove: boolean;
  onApprove: () => void;
  approving?: boolean;
}) {
  const [showUnauthorized, setShowUnauthorized] = useState(false);

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

      {status === 'pending' && (
        <button
          type="button"
          onClick={() => (canApprove ? onApprove() : setShowUnauthorized(true))}
          disabled={canApprove && approving}
          aria-disabled={!canApprove}
          aria-label={canApprove ? 'Approve this record' : 'Approve this record (not authorized)'}
          className={
            canApprove
              ? 'flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50'
              : 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-400 cursor-not-allowed'
          }
        >
          <ShieldCheck className="size-3.5" />
          {approving ? 'Approving…' : 'Approve'}
        </button>
      )}

      {showUnauthorized && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unauthorized-approve-title"
          onClick={(e) => e.target === e.currentTarget && setShowUnauthorized(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="size-4 text-destructive" />
              </div>
              <h3 id="unauthorized-approve-title" className="text-sm font-bold text-stone-900">
                Not authorized
              </h3>
            </div>
            <p className="mb-5 text-xs text-stone-600">{UNAUTHORIZED_APPROVE_MESSAGE}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowUnauthorized(false)}
                className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
