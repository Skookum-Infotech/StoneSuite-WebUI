import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileMinus, AlertCircle, Loader2, Save } from 'lucide-react';
import { creditMemoService } from '@/services/creditMemoService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { CreditMemoFormBody } from './components/CreditMemoFormBody';
import type { CustomerRef } from './components/CustomerPicker';
import type { InvoiceRef } from './components/InvoicePicker';
import type { SalesOrderRef } from './components/SalesOrderPicker';
import {
  creditMemoTotals, fromCreditMemo, toUpdatePayload, PAGE_TABS, BILLING_FIELDS, type PageTab,
  CREDIT_MEMO_DRAFT_STATUS,
} from '@/lib/creditMemoForm';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';
import { useScrollToError } from '@/hooks/useScrollToError';

export default function EditCreditMemoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: creditMemo, isLoading, error: loadError } = useQuery({
    queryKey: ['creditMemo', id],
    queryFn: () => creditMemoService.getCreditMemo(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (creditMemo?.creditMemoNumber) {
      setLabel(id, creditMemo.creditMemoNumber);
      return () => clearLabel(id);
    }
  }, [id, creditMemo?.creditMemoNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (creditMemo ? fromCreditMemo(creditMemo) : null), [creditMemo]);
  const data = localData ?? mapped?.data ?? {};
  const customer: CustomerRef | null = mapped?.customer ?? null;
  const invoice: InvoiceRef | null = mapped?.invoice ? { ...mapped.invoice, balanceDue: 0 } : null;
  const salesOrder: SalesOrderRef | null = mapped?.salesOrder ?? null;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? {};

  // Money fields (amount/sales tax/adjustment) are only editable while DRFT —
  // every other status disables just those fields, not the whole form.
  const moneyFieldsDisabled = (creditMemo?.statusCode ?? '') !== CREDIT_MEMO_DRAFT_STATUS;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) =>
      setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;
  const { subtotal, taxTotal, total } = useMemo(
    () => creditMemoTotals(data.amount, headerTaxPercent, adjustment),
    [data.amount, headerTaxPercent, adjustment],
  );

  const save = useMutation({
    mutationFn: () => {
      if (!creditMemo) throw new Error('Credit memo not loaded.');
      const amountEdited = String(data.amount ?? '') !== String(mapped?.data.amount ?? '');
      if (amountEdited && !(parseFloat(String(data.amount ?? '')) > 0)) {
        throw new Error('Enter an amount greater than zero.');
      }
      const badPhone = firstInvalidPhoneLabel(BILLING_FIELDS, data);
      if (badPhone) throw new Error(`Enter a valid phone number for ${badPhone}.`);
      return creditMemoService.updateCreditMemo(
        id,
        toUpdatePayload(
          data,
          creditMemo.recordVersion ?? 0,
          customFieldValues,
          String(mapped?.data.amount ?? ''),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditMemo', id] });
      queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
      if (creditMemo?.sourcePayment) {
        queryClient.invalidateQueries({ queryKey: ['payment', creditMemo.sourcePayment.id] });
      }
      navigate(`/sales/credit_memo/${id}`);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(save.error);

  if (isLoading) return <div className="p-6"><Spinner label="Loading credit memo…" /></div>;
  if (loadError || !creditMemo)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load credit memo.')}</ErrorNote></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Credit Memos"
          onBack={() => navigate(`/sales/credit_memo/${id}`)}
          icon={FileMinus}
          title={creditMemo.creditMemoNumber || 'Credit Memo'}
          subtitle={customer?.name ?? 'Edit credit memo'}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {save.error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save credit memo.')}
            </p>
          </div>
        )}

        <CreditMemoFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          creditMemoId={id}
          data={data}
          set={set}
          customer={customer}
          setCustomer={() => { /* immutable after creation */ }}
          customerLocked
          invoice={invoice}
          setInvoice={() => { /* immutable after creation */ }}
          invoiceLocked
          salesOrder={salesOrder}
          setSalesOrder={() => { /* immutable after creation */ }}
          salesOrderLocked
          sourcePayment={mapped?.sourcePayment ?? null}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          subtotal={subtotal}
          taxTotal={taxTotal}
          adjustment={adjustment}
          total={total}
          appliedTotal={creditMemo.appliedTotal}
          moneyFieldsDisabled={moneyFieldsDisabled}
        />

        <FormActionBar
          onCancel={() => navigate(`/sales/credit_memo/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
