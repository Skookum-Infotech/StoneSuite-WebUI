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
  fromCreditMemo, toUpdatePayload, PAGE_TABS, BILLING_FIELDS, type PageTab,
  type CreditMemoLineItem, CREDIT_MEMO_DRAFT_STATUS,
} from '@/lib/creditMemoForm';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { useScrollToError } from '@/hooks/useScrollToError';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: CreditMemoLineItem[] = [];

/** Unsaved edits carried across an "Add to Inventory" round trip. */
interface CreditMemoEditDraft {
  activeTab: PageTab;
  localData: Record<string, unknown> | null;
  localLineItems: CreditMemoLineItem[] | null;
  localCustomFields: Record<string, unknown> | null;
}

export default function EditCreditMemoPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inventoryReturn = useInventoryItemReturn<CreditMemoEditDraft>();
  const restored = inventoryReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(restored?.localData ?? null);
  const [localLineItems, setLocalLineItems] = useState<CreditMemoLineItem[] | null>(restored?.localLineItems ?? null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(restored?.localCustomFields ?? null);

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
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer: CustomerRef | null = mapped?.customer ?? null;
  const invoice: InvoiceRef | null = mapped?.invoice ? { ...mapped.invoice, balanceDue: 0 } : null;
  const salesOrder: SalesOrderRef | null = mapped?.salesOrder ?? null;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? {};

  // Money fields (lines/sales tax/adjustment) are only editable while DRFT —
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

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = subtotal * (headerTaxPercent / 100);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal + adjustment };
  }, [lineItems, headerTaxPercent, adjustment]);

  const save = useMutation({
    mutationFn: () => {
      if (!creditMemo) throw new Error('Credit memo not loaded.');
      const badPhone = firstInvalidPhoneLabel(BILLING_FIELDS, data);
      if (badPhone) throw new Error(`Enter a valid phone number for ${badPhone}.`);
      return creditMemoService.updateCreditMemo(
        id,
        toUpdatePayload(data, lineItems, creditMemo.recordVersion ?? 0, customFieldValues),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditMemo', id] });
      queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
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

        <InventoryItemReturnContext.Provider
          value={inventoryReturn.provide({ activeTab, localData, localLineItems, localCustomFields })}
        >
          <CreditMemoFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            creditMemoId={id}
            data={data}
            set={set}
            lineItems={lineItems}
            setLineItems={setLocalLineItems}
            customer={customer}
            setCustomer={() => { /* immutable after creation */ }}
            customerLocked
            invoice={invoice}
            setInvoice={() => { /* immutable after creation */ }}
            invoiceLocked
            salesOrder={salesOrder}
            setSalesOrder={() => { /* immutable after creation */ }}
            salesOrderLocked
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            adjustment={adjustment}
            total={total}
            appliedTotal={creditMemo.appliedTotal}
            moneyFieldsDisabled={moneyFieldsDisabled}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate(`/sales/credit_memo/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
