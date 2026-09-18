import { useUserPermissions } from '@/hooks/useUserPermissions';
import { QUOTE_STATUS_CODES, QUOTE_ALLOWED_TRANSITIONS, QUOTE_STATUS_COLORS, needsApproval, quoteTransitionLabel } from '@/lib/quoteForm';
import { StatusSelect } from './StatusSelect';
import type { Quote } from '@/types/quote';

// Status select for the Quote Edit/Detail pages. Legal moves mirror the
// backend quote/transitions.go (spec §7), except that the record's own
// `nextStatusCodes` (when loaded) wins: with nobody configured to approve,
// the backend collapses the PAPV checkpoint and Approved out of Draft's
// moves, so Draft is offered Sent directly instead of "Submit for Approval".
// Every move needs the single quote:transition permission. A move is
// additionally blocked client-side while approvalStatus is 'pending' (the
// current status has configured approvers awaiting sign-off, AD-8) -- the
// backend would 409 with ErrApprovalRequired anyway, this just explains why
// up front instead of after a failed save. Use the ApprovalBanner (rendered
// by the Detail page) to actually approve.
export function QuoteStatusControl({ quote, onChange, disabled, variant }: {
  quote: Pick<Quote, 'statusCode' | 'approvalStatus' | 'nextStatusCodes'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('quote', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(quote)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={quote.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={QUOTE_STATUS_CODES}
      allowedTransitions={QUOTE_ALLOWED_TRANSITIONS}
      nextCodes={quote.nextStatusCodes}
      guard={guard}
      variant={variant}
      colorFor={(s) => QUOTE_STATUS_COLORS[s.label] ?? '#a8a29e'}
      labelFor={(s, fromCode) => quoteTransitionLabel(fromCode, s.code)}
    />
  );
}
