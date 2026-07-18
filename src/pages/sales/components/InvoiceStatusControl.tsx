import { useUserPermissions } from '@/hooks/useUserPermissions';
import { INVOICE_STATUS_CODES, INVOICE_ALLOWED_TRANSITIONS } from '@/lib/invoiceForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Invoice Edit page. Legal moves mirror the backend
// invoice/transitions.go (spec §7); every move needs the single
// invoice:transition permission — Invoice has no separate approve action in
// authz/catalog.go. The backend (ValidateTransition + RBAC) stays the source of
// truth; this control just shouldn't offer a move it knows would 409 or 403.
export function InvoiceStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "DRFT"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => ({
    permitted: isLoading || hasPermission('invoice', 'transition'),
    reason: 'You do not have permission to change status',
  });

  return (
    <StatusSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      statuses={INVOICE_STATUS_CODES}
      allowedTransitions={INVOICE_ALLOWED_TRANSITIONS}
      guard={guard}
    />
  );
}
