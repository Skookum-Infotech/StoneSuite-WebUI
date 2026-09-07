import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  PO_STATUS_CODES, PO_ALLOWED_TRANSITIONS, PO_STATUS_COLORS, isPoTransitionBlocked, poTransitionLabel,
} from '@/lib/purchaseOrderForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Status select for the Purchase Order List row and Detail page sidebar —
// mirrors SalesOrderStatusControl.tsx, replacing PurchaseOrderTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use (confirm only for a move that lands on a terminal status —
// PO_ALLOWED_TRANSITIONS marks CLSD/CANC that way). `labelFor` keeps the
// Purchase Order spec's action-verb phrasing ("Submit for Approval") instead
// of StatusSelect's default bare destination-status label.
export function PurchaseOrderStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (!isLoading && !hasPermission('purchase_order', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (isPoTransitionBlocked(code, order.approvalStatus, order.gated)) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={PO_STATUS_CODES}
      allowedTransitions={PO_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => PO_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => poTransitionLabel(fromCode, s.code)}
    />
  );
}
