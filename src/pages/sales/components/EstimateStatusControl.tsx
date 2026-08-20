import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ESTIMATE_STATUS_CODES, ESTIMATE_ALLOWED_TRANSITIONS, ESTIMATE_STATUS_COLORS, needsApproval } from '@/lib/estimateForm';
import { StatusSelect } from './StatusSelect';
import type { Estimate } from '@/types/estimate';

// Status select for the Estimate Edit/Detail pages. Legal moves mirror the
// backend estimate/transitions.go (spec §7); every move needs the single
// estimate:transition permission. A move is additionally blocked client-side
// while approvalStatus is 'pending' (the current status has configured
// approvers awaiting sign-off, AD-8) -- the backend would 409 with
// ErrApprovalRequired anyway, this just explains why up front instead of
// after a failed save. Use the ApprovalBanner (rendered by the Detail page)
// to actually approve.
export function EstimateStatusControl({ estimate, onChange, disabled, variant }: {
  estimate: Pick<Estimate, 'statusCode' | 'approvalStatus'>;
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('estimate', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(estimate)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={estimate.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={ESTIMATE_STATUS_CODES}
      allowedTransitions={ESTIMATE_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => ESTIMATE_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
