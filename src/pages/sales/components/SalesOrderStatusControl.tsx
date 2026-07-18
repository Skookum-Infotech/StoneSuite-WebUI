import { useUserPermissions } from '@/hooks/useUserPermissions';
import { SO_STATUS_CODES, SO_ALLOWED_TRANSITIONS } from '@/lib/salesOrderForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Sales Order Edit page. Legal moves mirror the backend
// salesorder/transitions.go (spec §8); every move needs the single
// sales_order:transition permission — Sales Order has no separate approve action
// in authz/catalog.go. The backend (ValidateTransition + RBAC) stays the source
// of truth; this control just shouldn't offer a move it knows would 409 or 403.
export function SalesOrderStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "DRFT"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => ({
    permitted: isLoading || hasPermission('sales_order', 'transition'),
    reason: 'You do not have permission to change status',
  });

  return (
    <StatusSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      statuses={SO_STATUS_CODES}
      allowedTransitions={SO_ALLOWED_TRANSITIONS}
      guard={guard}
    />
  );
}
