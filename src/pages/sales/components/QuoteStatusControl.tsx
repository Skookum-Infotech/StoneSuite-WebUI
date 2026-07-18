import { useUserPermissions } from '@/hooks/useUserPermissions';
import { QUOTE_STATUS_CODES, QUOTE_ALLOWED_TRANSITIONS } from '@/lib/quoteForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Quote Edit page. Legal moves mirror the backend
// quote/transitions.go (spec §7); every move needs the single quote:transition
// permission — Quote has no separate approve action in authz/catalog.go. The
// backend (ValidateTransition + RBAC) stays the source of truth; this control
// just shouldn't offer a move it knows would 409 or 403.
export function QuoteStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "DRFT"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => ({
    permitted: isLoading || hasPermission('quote', 'transition'),
    reason: 'You do not have permission to change status',
  });

  return (
    <StatusSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      statuses={QUOTE_STATUS_CODES}
      allowedTransitions={QUOTE_ALLOWED_TRANSITIONS}
      guard={guard}
    />
  );
}
