import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  EXPENSE_STATUS_CODES, EXPENSE_ALLOWED_TRANSITIONS, EXPENSE_STATUS_COLORS,
  isExpTransitionBlocked, expTransitionLabel,
} from '@/lib/expenseForm';
import { StatusSelect } from '@/pages/sales/components/StatusSelect';

// Status select for the Expense List row and Detail page sidebar — mirrors
// PurchaseOrderStatusControl.tsx, replacing ExpenseTransitionBar's
// always-modal-confirm button row with the same 1-click pill Sales/CRM
// already use (confirm only for a move that lands on a terminal status —
// EXPENSE_ALLOWED_TRANSITIONS marks REIM that way). RJCT never appears in
// EXPENSE_ALLOWED_TRANSITIONS as a SUBM target, so — same as
// ExpenseTransitionBar — this never offers it; rejection stays a dedicated
// action (RejectExpenseDialog) that captures a reason.
export function ExpenseStatusControl({ order, onChange, disabled, variant }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = (code: string) => {
    if (!isLoading && !hasPermission('expense', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (isExpTransitionBlocked(code, order.approvalStatus, order.gated)) {
      return { permitted: false, reason: 'Awaiting approval sign-off', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={order.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={EXPENSE_STATUS_CODES}
      allowedTransitions={EXPENSE_ALLOWED_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => EXPENSE_STATUS_COLORS[s.code] ?? '#a8a29e'}
      labelFor={(s, fromCode) => expTransitionLabel(fromCode, s.code)}
    />
  );
}
