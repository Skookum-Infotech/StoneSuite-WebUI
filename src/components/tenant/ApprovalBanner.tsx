import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';

/** Full-width banner shown between a detail page's record header and its tab
 *  bar whenever the record is awaiting approval — surfaces the assigned
 *  approver(s) and the Approve action without needing to scroll to the
 *  sidebar. Renders nothing once the record is approved or approval isn't
 *  required. Shared across CRM (Lead/Prospect/Customer) and the relational
 *  Sales modules (Estimate/Quote/Sales Order).
 *
 *  Messaging and the Approve control differ by who's looking and how far
 *  along quorum is (a status can require more than one approver -- e.g. 2 --
 *  and every one of them has to sign off before the gate clears, not just
 *  the first):
 *   - Not an approver (canApprove false): informational only, no button --
 *     a disabled "Approve" a caller can't use just invites a confused click.
 *   - The configured approver who hasn't signed off yet (canApprove true,
 *     callerAlreadyApproved false, isOverride false): a plain "needs your
 *     approval" call to action, naming how many sign-offs are still needed
 *     when more than one is required.
 *   - The configured approver who already signed off this round
 *     (callerAlreadyApproved true): no button (clicking again would be a
 *     no-op) -- confirms their part is done and names who's still pending.
 *   - A super admin who isn't personally configured as an approver
 *     (isOverride true): still gets the button, but labeled as an override
 *     so it's clear this bypasses the normal sign-off (skips quorum
 *     entirely) rather than counting as the assigned approver's decision
 *     (the backend logs it distinctly as "approve_override" for the same
 *     reason). */
export function ApprovalBanner({
  approverNames,
  canApprove,
  isOverride,
  requiredApprovals,
  approvedCount,
  callerAlreadyApproved,
  onApprove,
  approving,
}: {
  /** Names of approvers still awaiting sign-off this round (for CRM, which
   *  has no per-approver progress tracking, this is simply every configured
   *  approver). */
  approverNames: string[];
  canApprove: boolean;
  isOverride?: boolean;
  /** How many sign-offs the current status's quorum needs, e.g. 2. Omit for
   *  callers (CRM) that don't track quorum progress. */
  requiredApprovals?: number;
  /** How many of them have signed off so far. */
  approvedCount?: number;
  /** True when the caller is a configured approver who already signed off
   *  this round -- their part is done, but quorum may still need others. */
  callerAlreadyApproved?: boolean;
  onApprove: () => void;
  approving?: boolean;
}) {
  const names = approverNames.length > 0 ? approverNames.join(', ') : 'no remaining approver';
  const showsProgress = typeof requiredApprovals === 'number' && requiredApprovals > 1;
  const progress = showsProgress ? ` (${approvedCount ?? 0} of ${requiredApprovals} approved)` : '';
  const showButton = canApprove && !callerAlreadyApproved;

  let message: string;
  if (callerAlreadyApproved) {
    message = `You've approved${progress}. Still waiting on ${names}.`;
  } else if (!canApprove) {
    message = `Awaiting approval from ${names}${progress} — you're not a configured approver for this status.`;
  } else if (isOverride) {
    message = `Awaiting approval from ${names}${progress}. As a Super Admin, you can approve this on their behalf.`;
  } else {
    message = `This record needs your approval${progress}.`;
  }

  return (
    <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between 3xl:px-12 4xl:px-16">
      <div className="flex items-center gap-2 min-w-0">
        {callerAlreadyApproved ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
        )}
        <p className="text-xs font-medium text-amber-800 truncate">
          <span className="font-semibold">Pending Approval</span>
          {' — '}
          {message}
        </p>
      </div>

      {showButton && (
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          aria-label={isOverride ? 'Approve this record as Super Admin' : 'Approve this record'}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        >
          <ShieldCheck className="size-3.5" />
          {approving ? 'Approving…' : isOverride ? 'Approve as Super Admin' : 'Approve'}
        </button>
      )}
    </div>
  );
}
