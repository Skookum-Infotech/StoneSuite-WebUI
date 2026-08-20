import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS, PAYMENT_STATUS_COLORS, needsApproval } from '@/lib/paymentForm';
import { StatusSelect } from './StatusSelect';
import type { Payment } from '@/types/payment';

// Status select for the Payment Edit/Detail pages. Payment's transitions
// branch (PEND -> APPV|VOID, APPV -> DEPO|VOID; DEPO/VOID terminal — backend
// spec §7), so only the current status plus its legal next-moves are
// offered. Every move needs the single payment:transition permission. A
// move is additionally blocked client-side while the payment is gated on
// approval (AD-8) -- the backend would 409 with ErrApprovalRequired anyway,
// this just explains why up front instead of after a failed save. Use the
// ApprovalBanner (rendered by the Detail page) to actually approve.
export function PaymentStatusControl({ payment, onChange, disabled, variant }: {
  payment: Pick<Payment, 'statusCode' | 'approvalStatus'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('payment', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(payment)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={payment.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={PAYMENT_STATUS_CODES}
      allowedTransitions={PAYMENT_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => PAYMENT_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
