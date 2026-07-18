import { useUserPermissions } from '@/hooks/useUserPermissions';
import { REFUND_STATUS_CODES, REFUND_ALLOWED_TRANSITIONS, transitionPermission } from '@/lib/refundForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Refund Edit page. Legal moves mirror the backend
// refund/transitions.go (PEND -> APPV|VOID, APPV -> SENT|VOID; SENT/VOID
// terminal — spec §7).
//
// What's different from every other status control in this family: Refund
// splits its transitions across *two* permissions (spec AD-4; server twin
// actionForTransition in controllers/refund_transition.go). Approving is what
// authorizes the refund to draw down real money, so PEND -> APPV needs
// `refund:approve` while every other move needs `refund:transition`. A user
// holding transition-but-not-approve (the `customer_support` role, spec §12)
// can void a draft but cannot approve one — so the guard disables, rather than
// hides, the moves they lack and says why. The backend stays authoritative: an
// illegal move is a 409 and a permission-less one a 403.
export function RefundStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "PEND"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
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
      value={value}
      onChange={onChange}
      disabled={disabled}
      statuses={REFUND_STATUS_CODES}
      allowedTransitions={REFUND_ALLOWED_TRANSITIONS}
      guard={guard}
    />
  );
}
