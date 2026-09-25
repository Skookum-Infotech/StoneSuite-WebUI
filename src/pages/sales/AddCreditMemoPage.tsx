import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileMinus, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { creditMemoService } from '@/services/creditMemoService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields, BILL_ADDRESS_KEYS } from '@/lib/customerDefaults';
import { defaultCountryId } from '@/lib/lookupDefaults';
import { type InvoiceRef } from './components/InvoicePicker';
import { type SalesOrderRef } from './components/SalesOrderPicker';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { useScrollToError } from '@/hooks/useScrollToError';
import { CreditMemoFormBody } from './components/CreditMemoFormBody';
import {
  creditMemoDefaults, creditMemoTotals, toCreatePayload, PAGE_TABS, BILLING_FIELDS, type PageTab,
} from '@/lib/creditMemoForm';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';
import {
  creditMemoFromPaymentPrefill,
  creditMemoFromPaymentState,
} from '@/lib/creditMemoHandoff';
import type { CreditMemoPaymentRef } from '@/types/creditMemo';

/** Unsaved form state carried across a "Create Customer" round trip. */
interface CreditMemoDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  customer: CustomerRef | null;
  invoice: InvoiceRef | null;
  salesOrder: SalesOrderRef | null;
  sourcePayment: CreditMemoPaymentRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddCreditMemoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const customerReturn = useRecordCreateReturn<CreditMemoDraft, CustomerRef>(
    'customer', '/crm/customer/new', { resource: 'customer', action: 'create' },
  );
  const restored = customerReturn.restored;
  const paymentHandoff = useMemo(() => creditMemoFromPaymentState(location.state), [location.state]);
  const paymentHandoffPrefill = useMemo(
    () => paymentHandoff ? creditMemoFromPaymentPrefill(paymentHandoff) : null,
    [paymentHandoff],
  );

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(
    () => restored?.data ?? paymentHandoffPrefill?.data ?? creditMemoDefaults(),
  );
  const [customer, setCustomer] = useState<CustomerRef | null>(() => restored?.customer ?? (
    paymentHandoff
      ? { id: paymentHandoff.customer.id, name: paymentHandoff.customer.name }
      : null
  ));
  const [invoice, setInvoice] = useState<InvoiceRef | null>(
    () => restored?.invoice ?? paymentHandoffPrefill?.invoice ?? null,
  );
  const [salesOrder, setSalesOrder] = useState<SalesOrderRef | null>(restored?.salesOrder ?? null);
  // The payment whose overpayment funds this memo. It belongs to one customer,
  // so it is dropped the moment the customer changes.
  const [sourcePayment, setSourcePayment] = useState<CreditMemoPaymentRef | null>(() => restored?.sourcePayment ?? (
    paymentHandoff
      ? { id: paymentHandoff.payment.id, number: paymentHandoff.payment.number ?? '' }
      : null
  ));
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const handleCustomerChange = useCallback((next: CustomerRef | null) => {
    setCustomer(next);
    if (next?.id !== customer?.id) {
      setInvoice(null);
      setSalesOrder(null);
      setSourcePayment(null);
      setData((current) => ({ ...current, currency_id: '' }));
    }
    if (next) {
      const defaults = customerDefaultFields(next);
      setData((d) => ({
        ...d,
        ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !d[k] || BILL_ADDRESS_KEYS.has(k))),
      }));
    }
  }, [customer?.id]);

  // Applies the customer created via the round trip exactly as if it had
  // been picked from the list — same Bill To/currency/tax defaulting.
  useEffect(() => {
    if (customerReturn.createdRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleCustomerChange(customerReturn.createdRef);
      customerReturn.consumeCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerReturn.createdRef]);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // New credit memos default their billing address to United States once the
  // lookups load — derived rather than copied into state, so it never
  // clobbers a value the user (or a picked customer's defaults) already set.
  const formData = useMemo(() => {
    if (!lookups) return data;
    return { ...data, bill_country: data.bill_country || defaultCountryId(lookups.countries) };
  }, [data, lookups]);

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;
  const { subtotal, taxTotal, total } = useMemo(
    () => creditMemoTotals(data.amount, headerTaxPercent, adjustment),
    [data.amount, headerTaxPercent, adjustment],
  );

  const draft: CreditMemoDraft = { activeTab, data, customer, invoice, salesOrder, sourcePayment, customFieldValues };
  const { startCreate: startCreateCustomer } = customerReturn.provide(draft);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A customer is required.');
      if (!(parseFloat(String(formData.amount ?? '')) > 0)) throw new Error('Enter an amount greater than zero.');
      const badPhone = firstInvalidPhoneLabel(BILLING_FIELDS, formData);
      if (badPhone) throw new Error(`Enter a valid phone number for ${badPhone}.`);
      const payload = toCreatePayload(
        {
          ...formData,
          customer_uuid: customer.id,
          invoice_uuid: invoice?.id,
          sales_order_uuid: salesOrder?.id,
          source_payment_uuid: sourcePayment?.id,
        },
        customFieldValues,
      );
      return creditMemoService.createCreditMemo(payload);
    },
    onSuccess: async (creditMemo) => {
      toast.success('Credit memo created.');
      queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
      if (sourcePayment) queryClient.invalidateQueries({ queryKey: ['payment', sourcePayment.id] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(creditMemo.id); } catch { /* non-fatal */ }
      }
      navigate(`/sales/credit_memo/${creditMemo.id}`);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Credit Memos"
          onBack={() => navigate('/sales/credit_memo')}
          icon={FileMinus}
          title="New Credit Memo"
          subtitle={sourcePayment
            ? `Prefilled from ${sourcePayment.number || 'the payment'}. Review before saving.`
            : 'Fields marked * are required.'}
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Credit Memo'}
            </button>
          )}
        />

        {saveError && (
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
              {apiErrorMessage(saveError, 'Failed to save credit memo.')}
            </p>
          </div>
        )}

        <CreditMemoFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={formData}
          set={set}
          customer={customer}
          setCustomer={handleCustomerChange}
          onCreateCustomer={startCreateCustomer}
          invoice={invoice}
          setInvoice={setInvoice}
          salesOrder={salesOrder}
          setSalesOrder={setSalesOrder}
          sourcePayment={sourcePayment}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          subtotal={subtotal}
          taxTotal={taxTotal}
          adjustment={adjustment}
          total={total}
          appliedTotal={0}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/credit_memo')}
          isPending={isPending}
          submitLabel="Save Credit Memo"
        />
      </form>
    </div>
  );
}
