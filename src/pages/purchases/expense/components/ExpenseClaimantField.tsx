import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls } from '@/components/crm/formUtils';
import { expenseService } from '@/services/expenseService';

const CLAIMANTS_STALE_MS = 5 * 60 * 1000;

/** The Employee picker on the expense form: who the claim is for. A new claim
 *  starts as the person filing it ("Myself" — the server's default); anyone with
 *  expense access can pick another Active employee to file it for them. An
 *  existing claim always names its claimant, so "Myself" is only offered while
 *  adding. `currentName` keeps a claimant who is no longer in the Active list
 *  (made inactive since) visible instead of showing a blank. */
export function ExpenseClaimantField({ value, onChange, allowSelf, currentName }: {
  value: string;
  onChange: (next: string) => void;
  allowSelf: boolean;
  currentName?: string;
}) {
  const { data: claimants = [], isLoading } = useQuery({
    queryKey: ['expense-claimants'],
    queryFn: expenseService.getClaimants,
    staleTime: CLAIMANTS_STALE_MS,
  });

  const known = claimants.some((c) => String(c.id) === value);

  return (
    <ModernFieldShell label="Employee" required>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldCls}
        aria-label="Employee"
        disabled={isLoading}
      >
        {allowSelf && <option value="">Myself</option>}
        {value && !known && <option value={value}>{currentName || 'Current employee'}</option>}
        {claimants.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
      </Select>
      <p className="type-helper">Who this expense is for. The bill is raised to this employee.</p>
    </ModernFieldShell>
  );
}
