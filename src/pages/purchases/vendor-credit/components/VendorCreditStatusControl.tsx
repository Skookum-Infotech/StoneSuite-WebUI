import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  VC_STATUS_CODES, VC_ALLOWED_TRANSITIONS, VC_STATUS_COLORS, transitionPermission, vcTransitionLabel,
} from '@/lib/vendorCreditForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Status select for the Vendor Credit List row and Detail page sidebar —
// mirrors PurchaseOrderStatusControl.tsx, replacing VendorCreditTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use. Unlike the other Purchases modules, Vendor Credit splits its
// two moves across *two* permissions on the same generic endpoint (backend
// AD-2): DRFT->APPV needs `vendor_credit:approve`, every other move needs
// `vendor_credit:transition` — mirrored here via transitionPermission(toCode)
// per-option, same as VendorCreditTransitionBar did. VC_ALLOWED_TRANSITIONS
// marks VOID (and APPL) terminal, so the arm-and-confirm only engages there.
export function VendorCreditStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus?: string; gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    const perm = transitionPermission(code);
    if (!isLoading && !hasPermission('vendor_credit', perm)) {
      return { permitted: false, reason: `Needs the ${perm} permission` };
    }
    if (code === 'APPV' && (order.gated ?? order.approvalStatus === 'pending')) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={VC_STATUS_CODES}
      allowedTransitions={VC_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => VC_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => vcTransitionLabel(fromCode, s.code)}
    />
  );
}
