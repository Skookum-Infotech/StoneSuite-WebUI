import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  REQUISITION_STATUS_CODES, REQUISITION_ALLOWED_TRANSITIONS, REQUISITION_STATUS_COLORS,
  isReqnTransitionBlocked, reqnTransitionLabel,
} from '@/lib/requisitionForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Status select for the Requisition List row and Detail page sidebar —
// mirrors PurchaseOrderStatusControl.tsx, replacing RequisitionTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use (confirm only for a move that lands on a terminal status —
// REQUISITION_ALLOWED_TRANSITIONS marks CANC that way).
export function RequisitionStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (!isLoading && !hasPermission('requisition', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (isReqnTransitionBlocked(code, order.approvalStatus, order.gated)) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={REQUISITION_STATUS_CODES}
      allowedTransitions={REQUISITION_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => REQUISITION_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => reqnTransitionLabel(fromCode, s.code)}
    />
  );
}
