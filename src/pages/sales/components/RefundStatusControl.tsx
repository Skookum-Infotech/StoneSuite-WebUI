import { useUserPermissions } from '@/hooks/useUserPermissions';
import { REFUND_STATUS_CODES, REFUND_ALLOWED_TRANSITIONS, REFUND_STATUS_COLORS, transitionPermission, needsApproval } from '@/lib/refundForm';
import { StatusSelect } from './StatusSelect';
import type { Refund } from '@/types/refund';

// Status select for the Refund Edit/Detail pages. Legal moves mirror the
// backend refund/transitions.go (PEND -> APPV|VOID, APPV -> SENT|VOID;
// SENT/VOID terminal — spec §7).
//
// What's different from every other status control in this family: Refund
// splits its transitions across *two* permissions (spec AD-4; server twin
// actionForTransition in controllers/refund_transition.go). Approving is what
// authorizes the refund to draw down real money, so PEND -> APPV needs
// `refund:approve` while every other move needs `refund:transition`. A user
// holding transition-but-not-approve (the `customer_support` role, spec §12)
// can void a draft but cannot approve one — so the guard disables, rather than
// hides, the moves they lack and says why.
//
// On top of that RBAC split, the PEND -> APPV move is *also* blocked
// client-side while the refund is AD-8 gated (needsApproval) -- once real
// approvers are configured for PEND, even a refund:approve holder can't
// flip it straight to Approved via this dropdown; they go through the
// ApprovalBanner (rendered by the Detail page) instead, same as every other
// approval-gated module. The backend stays authoritative either way: an
// illegal move is a 409 and a permission-less one a 403.
export function RefundStatusControl({ refund, onChange, disabled, variant }: {
  refund: Pick<Refund, 'statusCode' | 'approvalStatus'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (code === 'APPV' && needsApproval(refund)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    const perm = transitionPermission(code);
    const permitted = isLoading || hasPermission('refund', perm);
    const needsApprove = !permitted && perm === 'approve';
    return {
      permitted,
      needsApprove,
      reason: needsApprove
        ? 'Needs the approve permission'
        : 'You do not have permission for this change',
    };
  };

  return (
    <StatusSelect
      value={refund.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={REFUND_STATUS_CODES}
      allowedTransitions={REFUND_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => REFUND_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
