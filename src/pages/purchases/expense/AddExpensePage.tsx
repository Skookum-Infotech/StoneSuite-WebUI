import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, AlertCircle, Loader2, Save } from 'lucide-react';
import { expenseService } from '@/services/expenseService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { ExpenseFormBody } from './components/ExpenseFormBody';
import {
  expenseDefaults, toCreatePayload, calcHeaderTotal, invalidLinePositions,
  PAGE_TABS, type PageTab, type ExpenseLineItem,
} from '@/lib/expenseForm';

export default function AddExpensePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(expenseDefaults);
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const guard = useUnsavedChangesGuard({ data, lineItems, customFieldValues });

  const total = useMemo(() => calcHeaderTotal(lineItems), [lineItems]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      // The server requires every line to carry a category, a date, and a
      // non-negative amount; catch it here so the user sees which row is at
      // fault rather than a whole-form 400.
      const bad = invalidLinePositions(lineItems);
      if (bad.length > 0) {
        throw new Error(
          `Every line needs a category, a date, and an amount — check line ${bad.join(', ')}.`,
        );
      }
      const payload = toCreatePayload(data, lineItems, customFieldValues);
      return expenseService.createExpense(payload);
    },
    onSuccess: async (exp) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(exp.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/expense');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Expenses"
          onBack={() => navigate('/purchases/expense')}
          icon={Wallet}
          title="New Expense"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Expense'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save expense claim.')}
            </p>
          </div>
        )}

        <ExpenseFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLineItems}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          total={total}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/purchases/expense')}
          isPending={isPending}
          submitLabel="Save Expense"
        />
      </form>
    </div>
  );
}
