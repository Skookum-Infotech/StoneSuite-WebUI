import { useUserPermissions } from '@/hooks/useUserPermissions';
import { SO_STATUS_CODES, SO_ALLOWED_TRANSITIONS, SO_STATUS_COLORS, needsApproval } from '@/lib/salesOrderForm';
import { StatusSelect } from './StatusSelect';
import type { SalesOrder } from '@/types/salesOrder';

// Status select for the Sales Order Edit page (variant="field", the default)
// and, since both List and Detail pages now offer inline status changes, also
// for those (variant="pill"). Legal moves mirror the backend
// salesorder/transitions.go (spec §8); every move needs the single
// sales_order:transition permission. A move is additionally blocked
// client-side while approvalStatus is 'pending' (the current status has
// configured approvers awaiting sign-off, AD-10) -- the backend would 409
// with ErrApprovalRequired anyway, this just explains why up front instead
// of after a failed save. Use the ApprovalBanner (rendered by the Detail
// page) to actually approve.
export function SalesOrderStatusControl({ order, onChange, disabled, variant }: {
  order: Pick<SalesOrder, 'statusCode' | 'approvalStatus'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('sales_order', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(order)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={SO_STATUS_CODES}
      allowedTransitions={SO_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => SO_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
