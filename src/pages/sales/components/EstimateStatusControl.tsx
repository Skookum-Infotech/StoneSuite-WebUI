import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ESTIMATE_STATUS_CODES, ESTIMATE_ALLOWED_TRANSITIONS, ESTIMATE_STATUS_COLORS } from '@/lib/estimateForm';
import { StatusSelect } from './StatusSelect';

// Status select for the Estimate Edit page. Legal moves mirror the backend
// estimate/transitions.go (spec §7); every move needs the single
// estimate:transition permission — Estimate has no separate approve action in
// authz/catalog.go. The backend (ValidateTransition + RBAC) stays the source of
// truth; this control just shouldn't offer a move it knows would 409 or 403.
export function EstimateStatusControl({ value, onChange, disabled, variant }: {
  value: string; // current status code, e.g. "DRFT"
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => ({
    permitted: isLoading || hasPermission('estimate', 'transition'),
    reason: 'You do not have permission to change status',
  });

  return (
    <StatusSelect
      value={value}
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
