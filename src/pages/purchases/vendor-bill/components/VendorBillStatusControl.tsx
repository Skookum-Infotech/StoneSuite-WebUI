import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  VB_STATUS_CODES, VB_ALLOWED_TRANSITIONS, VB_STATUS_COLORS, isVbTransitionBlocked, vbTransitionLabel,
} from '@/lib/vendorBillForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Status select for the Vendor Bill List row and Detail page sidebar —
// mirrors PurchaseOrderStatusControl.tsx, replacing VendorBillTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use (confirm only for a move that lands on a terminal status —
// VB_ALLOWED_TRANSITIONS marks PAID/VOID that way). The record's own
// `nextStatusCodes` (when loaded) wins over the static map: with nobody
// configured to approve, the backend collapses the PAPV checkpoint out of
// Draft's moves and offers Approved in one step ("Approve") -- a bill must
// be Approved before anything can be paid against it, so it is never skipped.
export function VendorBillStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean; nextStatusCodes?: string[] };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (!isLoading && !hasPermission('vendor_bill', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (isVbTransitionBlocked(code, order.approvalStatus, order.gated)) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={VB_STATUS_CODES}
      allowedTransitions={VB_ALLOWED_TRANSITIONS}
      nextCodes={order.nextStatusCodes}
      guard={guard}
      variant={variant}
      colorFor={(s) => VB_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => vbTransitionLabel(fromCode, s.code)}
    />
  );
}
