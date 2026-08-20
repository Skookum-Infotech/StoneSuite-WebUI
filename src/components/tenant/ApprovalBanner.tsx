import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

const UNAUTHORIZED_APPROVE_MESSAGE =
  'You are not authorized to approve this document. Only the assigned approver(s) can approve it.';

/** Full-width banner shown between a detail page's record header and its tab
 *  bar whenever the record is awaiting approval — surfaces the assigned
 *  approver(s) and the Approve action without needing to scroll to the
 *  sidebar. Renders nothing once the record is approved or approval isn't
 *  required. Shared across CRM (Lead/Prospect/Customer) and the relational
 *  Sales modules (Estimate/Quote/Sales Order). */
export function ApprovalBanner({
  approverNames,
  canApprove,
  onApprove,
  approving,
}: {
  approverNames: string[];
  canApprove: boolean;
  onApprove: () => void;
  approving?: boolean;
}) {
  const [showUnauthorized, setShowUnauthorized] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between 3xl:px-12 4xl:px-16">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="text-xs font-medium text-amber-800 truncate">
          <span className="font-semibold">Pending Approval</span>
          {' — assigned to '}
          {approverNames.length > 0 ? approverNames.join(', ') : 'no active approver'}
        </p>
      </div>

      <button
        type="button"
        onClick={() => (canApprove ? onApprove() : setShowUnauthorized(true))}
        disabled={canApprove && approving}
        aria-disabled={!canApprove}
        aria-label={canApprove ? 'Approve this record' : 'Approve this record (not authorized)'}
        className={
          canApprove
            ? 'flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50'
            : 'flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-400 cursor-not-allowed'
        }
      >
        <ShieldCheck className="size-3.5" />
        {approving ? 'Approving…' : 'Approve'}
      </button>

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
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
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
