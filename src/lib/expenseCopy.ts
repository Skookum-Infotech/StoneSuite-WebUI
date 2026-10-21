import type { Expense } from '@/types/expense';
import { resetCopiedFields } from './recordCopy';
import { expenseDefaults, fromExpense } from './expenseForm';

/** What a copied expense must not inherit: its number and status. */
const EXPENSE_COPY_RESET_FIELDS = ['exp_status', 'exp_doc_num'] as const;

/** The Add Expense form's starting state for "Copy expense". */
export function fromExpenseForCopy(exp: Expense): ReturnType<typeof fromExpense> {
  const mapped = fromExpense(exp);
  return {
    ...mapped,
    data: resetCopiedFields(mapped.data, expenseDefaults(), EXPENSE_COPY_RESET_FIELDS),
    // Each line's date is required and must be chosen afresh: a stale date is
    // worse than the "needs a date" prompt a blank one gives.
    lineItems: mapped.lineItems.map((line) => ({ ...line, expenseDate: '' })),
  };
}
