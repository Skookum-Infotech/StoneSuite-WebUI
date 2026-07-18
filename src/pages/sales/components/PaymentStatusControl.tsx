import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS } from '@/lib/paymentForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Payment Edit page. Payment's transitions branch
// (PEND -> APPV|VOID, APPV -> DEPO|VOID; DEPO/VOID terminal — backend spec §7),
// so only the current status plus its legal next-moves are offered. Every move
// needs the single payment:transition permission — Payment has no separate
// approve action in authz/catalog.go. The backend (payment.Transition + RBAC)
// stays the source of truth; this control just shouldn't offer a 409/403 move.
export function PaymentStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "PEND"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => ({
    permitted: isLoading || hasPermission('payment', 'transition'),
    reason: 'You do not have permission to change status',
  });

  return (
    <StatusSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      statuses={PAYMENT_STATUS_CODES}
      allowedTransitions={PAYMENT_ALLOWED_TRANSITIONS}
      guard={guard}
    />
  );
}
