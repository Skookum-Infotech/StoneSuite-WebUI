import { useUserPermissions } from '@/hooks/useUserPermissions';
import { INVOICE_STATUS_CODES, INVOICE_ALLOWED_TRANSITIONS, INVOICE_STATUS_COLORS, needsApproval } from '@/lib/invoiceForm';
import { StatusSelect } from './StatusSelect';
import type { Invoice } from '@/types/invoice';

// Status select for the Invoice Edit/Detail pages. Legal moves mirror the
// backend invoice/transitions.go (spec §7); every move needs the single
// invoice:transition permission. A move is additionally blocked client-side
// while the invoice is gated on approval (AD-8) -- the backend would 409
// with ErrApprovalRequired anyway, this just explains why up front instead
// of after a failed save. Use the ApprovalBanner (rendered by the Detail
// page) to actually approve.
export function InvoiceStatusControl({ invoice, onChange, disabled, variant }: {
  invoice: Pick<Invoice, 'statusCode' | 'approvalStatus'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('invoice', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(invoice)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={invoice.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={INVOICE_STATUS_CODES}
      allowedTransitions={INVOICE_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => INVOICE_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
