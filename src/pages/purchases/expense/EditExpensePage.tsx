import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { expenseService } from '@/services/expenseService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { ExpenseFormBody } from './components/ExpenseFormBody';
import {
  fromExpense, toCreatePayload, calcHeaderTotal, invalidLinePositions,
  PAGE_TABS, type PageTab, type ExpenseLineItem, EXPENSE_NON_DRAFT_LOCKED,
} from '@/lib/expenseForm';

// Stable references so the fallbacks don't create a new identity every render
// (which would defeat the total useMemo below).
const EMPTY_ITEMS: ExpenseLineItem[] = [];
const EMPTY_CUSTOM: Record<string, unknown> = {};

// Editing an expense claim is DRFT-only (backend enforces with 400) — once
// submitted it is awaiting someone's sign-off, so any other status renders
// read-only with "recall to draft to edit". Mirrors EditRequisitionPage.
export default function EditExpensePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<ExpenseLineItem[] | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: exp, isLoading, error: loadError } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expenseService.getExpense(id),
    enabled: Boolean(id),
  });

  // Never show a raw record UUID in the breadcrumb — swap in the expense
  // number once the record loads, and clear it on unmount.
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (exp?.expenseNumber) {
      setLabel(id, exp.expenseNumber);
      return () => clearLabel(id);
    }
  }, [id, exp?.expenseNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (exp ? fromExpense(exp) : null), [exp]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = exp ? EXPENSE_NON_DRAFT_LOCKED(exp.statusCode) : false;

  // Baseline against the loaded record, not the empty defaults, so simply
  // opening the page never counts as an edit. A locked claim is read-only —
  // nothing to lose.
  const guard = useUnsavedChangesGuard(
    { data, lineItems, customFieldValues },
    Boolean(mapped) && !isLocked,
  );

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) => setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const total = useMemo(() => calcHeaderTotal(lineItems), [lineItems]);

  const save = useMutation({
    mutationFn: () => {
      const bad = invalidLinePositions(lineItems);
      if (bad.length > 0) {
        throw new Error(`Every line needs a category, a date, and an amount — check line ${bad.join(', ')}.`);
      }
      return expenseService.updateExpense(id, toCreatePayload(data, lineItems, customFieldValues));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      guard.markClean();
      navigate(`/purchases/expense/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading expense claim…" /></div>;
  // A 404 here can mean "exists but is out of your scope" as well as "no such
  // record", so the copy stays non-committal about whether it exists.
  if (loadError || !exp)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Expense claim not available.')}</ErrorNote></div>;

  if (isLocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Expenses"
          onBack={() => navigate(`/purchases/expense/${id}`)}
          icon={Wallet}
          title={exp.expenseNumber || 'Expense'}
          subtitle={exp.department || undefined}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This expense claim is {exp.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">Recall it to Draft from the detail page to make changes.</p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/expense/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to expense
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Expenses"
          onBack={() => navigate('/purchases/expense')}
          icon={Wallet}
          title={exp.expenseNumber || 'Expense'}
          subtitle={exp.department || 'Edit expense claim'}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {save.error && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save expense claim.')}
            </p>
          </div>
        )}

        <ExpenseFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          expenseId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          total={total}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/expense/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
