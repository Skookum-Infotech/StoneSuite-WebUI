import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls } from '@/components/crm/formUtils';
import { expenseService } from '@/services/expenseService';
import type { VendorBillExpenseRef } from '@/types/vendorBill';

const CLAIMS_STALE_MS = 30 * 1000;

function money(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

/** The Vendor Bill form's optional "Expense Claim" source — shown only when the
 *  chosen vendor is an employee with approved expense claims still waiting for a
 *  bill (or a claim is already picked), so an ordinary supplier's bill never
 *  carries the field. Picking a claim is the page's cue to fill the bill from it
 *  (see AddVendorBillPage's changeExpense). `disabled` is set while a purchase
 *  order is linked: a bill comes from one source or the other. */
export function ExpenseClaimField({ vendor, value, onChange, disabled }: {
  vendor: { id: string } | null;
  value: VendorBillExpenseRef | null;
  onChange: (next: VendorBillExpenseRef | null) => void;
  disabled?: boolean;
}) {
  const { data: claims = [] } = useQuery({
    queryKey: ['billable-expense-claims', vendor?.id],
    queryFn: () => expenseService.getBillableClaims(vendor?.id ?? ''),
    enabled: Boolean(vendor),
    staleTime: CLAIMS_STALE_MS,
  });

  if (!vendor || (claims.length === 0 && !value)) return null;

  return (
    <ModernFieldShell label="Expense Claim">
      <Select
        value={value?.id ?? ''}
        onChange={(e) => {
          const picked = claims.find((c) => c.id === e.target.value);
          onChange(picked ? { id: picked.id, number: picked.expenseNumber } : null);
        }}
        disabled={disabled}
        className={fieldCls}
        aria-label="Expense claim"
      >
        <option value="">— None —</option>
        {value && !claims.some((c) => c.id === value.id) && <option value={value.id}>{value.number}</option>}
        {claims.map((c) => (
          <option key={c.id} value={c.id}>{`${c.expenseNumber} · ${money(c.total)}`}</option>
        ))}
      </Select>
      <p className="type-helper">
        Approved claims of this employee that have no bill yet. Picking one fills the bill from it.
      </p>
    </ModernFieldShell>
  );
}
