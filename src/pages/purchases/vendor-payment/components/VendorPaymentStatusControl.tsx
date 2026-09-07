import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  VP_STATUS_CODES, VP_ALLOWED_TRANSITIONS, VP_STATUS_COLORS,
  isVpTransitionBlocked, isScheduleBlocked, vpTransitionLabel, vpTransitionTargets,
} from '@/lib/vendorPaymentForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Filtered once at module scope: PAPV->APPV is approval-only (the generic
// /transition endpoint 409s it — only the /approve sign-off crosses that
// edge). vpTransitionTargets already excludes it from
// VendorPaymentTransitionBar's button row; StatusSelect's `allowedTransitions`
// needs the same filtered map so its picklist never offers it either.
const VP_PILL_TRANSITIONS: Record<string, string[]> = Object.fromEntries(
  Object.keys(VP_ALLOWED_TRANSITIONS).map((code) => [code, vpTransitionTargets(code)]),
);

// Status select for the Vendor Payment List row and Detail page sidebar —
// mirrors PurchaseOrderStatusControl.tsx, replacing VendorPaymentTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use (confirm only for a move that lands on a terminal status —
// VP_ALLOWED_TRANSITIONS marks VOID that way).
export function VendorPaymentStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean; scheduledDate?: string | null };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (!isLoading && !hasPermission('vendor_payment', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (isVpTransitionBlocked(code, order.approvalStatus, order.gated)) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    if (isScheduleBlocked(code, order.scheduledDate)) {
      return { permitted: false, reason: 'Set a scheduled date first' };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={VP_STATUS_CODES}
      allowedTransitions={VP_PILL_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => VP_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => vpTransitionLabel(fromCode, s.code)}
    />
  );
}
