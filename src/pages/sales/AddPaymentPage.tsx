import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@/services/paymentService';
import { invoiceService } from '@/services/invoiceService';
import { lookupService, type CrmLookups } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import { CustomerPicker } from './components/CustomerPicker';
import type { CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields, BILL_ADDRESS_KEYS } from '@/lib/customerDefaults';
import { defaultCurrencyId } from '@/lib/lookupDefaults';
import { InvoicePicker } from './components/InvoicePicker';
import type { InvoiceRef } from './components/InvoicePicker';
import { ExcessPaymentDialog, type ExcessPaymentPrompt } from './components/ExcessPaymentDialog';
import { PaymentSectionGrid } from './components/PaymentFormFields';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { useScrollToError } from '@/hooks/useScrollToError';
import {
  PRIMARY_INFO_FIELDS, fromSourceInvoice, paymentDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/paymentForm';
import type { ApplicationInput } from '@/types/payment';
import { CREDIT_MEMO_FROM_PAYMENT_STATE } from '@/lib/creditMemoHandoff';
import {
  applicationsForConfirmedExcess, checkPaymentAgainstInvoices, creditMemoExcessAmount, pendingInvoiceLine,
  type AppliedInvoiceLine,
} from '@/lib/paymentExcess';
import { INVOICE_PAYABLE_STATUSES } from '@/lib/invoiceForm';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';

const PAYMENT_AMOUNT_TOLERANCE = 0.005;

function currency(value: number, currencyCode: string): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: currencyCode });
}

function currencyIdFrom(data: Record<string, unknown>): number | null {
  const value = Number(data.currency_id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function currencyCodeFrom(data: Record<string, unknown>, lookups?: CrmLookups): string {
  const currencyId = currencyIdFrom(data);
  return lookups?.currencies.find((item) => item.id === currencyId)?.code ?? 'USD';
}

/** Unsaved form state carried across a "Create Customer" round trip. */
interface PaymentDraft {
  activeTab: PageTab;
  localData: Record<string, unknown> | null;
  localCustomer: CustomerRef | null;
  customerTouched: boolean;
  customFieldValues: Record<string, unknown>;
  localApplications: ApplicationInput[] | null;
  localAppliedInvoiceNumbers: Record<string, string> | null;
  localAppliedInvoiceBalances: Record<string, number> | null;
  pendingInvoice: InvoiceRef | null | undefined;
}

export default function AddPaymentPage() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const fromInvoiceId = searchParams.get('fromInvoice') ?? '';
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);
  const customerReturn = useRecordCreateReturn<PaymentDraft, CustomerRef>(
    'customer', '/crm/customer/new', { resource: 'customer', action: 'create' },
  );
  const restored = customerReturn.restored;

  const {
    data: sourceInvoice,
    isLoading: sourceInvoiceLoading,
    error: sourceInvoiceError,
  } = useQuery({
    queryKey: ['invoice', fromInvoiceId],
    queryFn: () => invoiceService.getInvoice(fromInvoiceId),
    enabled: Boolean(fromInvoiceId),
  });
  const sourceInvoicePayable = Boolean(
    sourceInvoice && INVOICE_PAYABLE_STATUSES.has(sourceInvoice.statusCode),
  );
  const prefill = useMemo(
    () => sourceInvoice && sourceInvoicePayable ? fromSourceInvoice(sourceInvoice) : null,
    [sourceInvoice, sourceInvoicePayable],
  );
  const sourceInvoiceUnavailable = Boolean(
    fromInvoiceId && (sourceInvoiceLoading || sourceInvoiceError || !sourceInvoicePayable),
  );
  const baseData = useMemo(
    () => ({ ...paymentDefaults(), ...(prefill?.data ?? {}) }),
    [prefill],
  );

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? 'details');
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(restored?.localData ?? null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(restored?.localCustomer ?? null);
  const [customerTouched, setCustomerTouched] = useState(restored?.customerTouched ?? false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});
  const [localApplications, setLocalApplications] = useState<ApplicationInput[] | null>(restored?.localApplications ?? null);
  const [localAppliedInvoiceNumbers, setLocalAppliedInvoiceNumbers] = useState<Record<string, string> | null>(restored?.localAppliedInvoiceNumbers ?? null);
  const [localAppliedInvoiceBalances, setLocalAppliedInvoiceBalances] = useState<Record<string, number> | null>(restored?.localAppliedInvoiceBalances ?? null);
  const [pendingInvoiceState, setPendingInvoiceState] = useState<InvoiceRef | null | undefined>(restored?.pendingInvoice);
  const [pendingAmount, setPendingAmount] = useState('');
  const [overpaymentPrompt, setOverpaymentPrompt] = useState<ExcessPaymentPrompt | null>(null);
  const [applicationAmountError, setApplicationAmountError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const data = localData ?? baseData;
  const customer = customerTouched ? localCustomer : (prefill?.customer ?? null);
  const applications = useMemo(() => localApplications ?? [], [localApplications]);
  const appliedInvoiceNumbers = useMemo(() => localAppliedInvoiceNumbers ?? {}, [localAppliedInvoiceNumbers]);
  const appliedInvoiceBalances = useMemo(() => localAppliedInvoiceBalances ?? {}, [localAppliedInvoiceBalances]);
  const pendingInvoice = pendingInvoiceState === undefined
    ? (prefill?.pendingInvoice ?? null)
    : pendingInvoiceState;
  const appliedLines = useMemo<AppliedInvoiceLine[]>(() => applications.flatMap((application) => {
    const balanceDue = appliedInvoiceBalances[application.invoiceUuid];
    if (balanceDue === undefined) return [];
    return [{
      invoiceUuid: application.invoiceUuid,
      invoiceNumber: appliedInvoiceNumbers[application.invoiceUuid] ?? 'Invoice',
      balanceDue,
      amount: application.amount,
    }];
  }), [applications, appliedInvoiceBalances, appliedInvoiceNumbers]);
  const returnPath = fromInvoiceId ? `/sales/invoice/${encodeURIComponent(fromInvoiceId)}` : '/sales/payment';

  const set = useCallback((key: string, value: unknown) => {
    if (key === 'amount') setAmountError(null);
    setLocalData((current) => ({ ...(current ?? baseData), [key]: value }));
  }, [baseData]);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const handleCustomerChange = useCallback((next: CustomerRef | null) => {
    setLocalCustomer(next);
    setCustomerTouched(true);
    if (fromInvoiceId) {
      setLocalApplications([]);
      setLocalAppliedInvoiceNumbers({});
      setLocalAppliedInvoiceBalances({});
      setPendingInvoiceState(null);
      setPendingAmount('');
    }
    setOverpaymentPrompt(null);
    setApplicationAmountError(null);
    setAmountError(null);
    if (next) {
      const defaults = customerDefaultFields(next);
      setLocalData((current) => {
        const values = current ?? baseData;
        return {
          ...values,
          ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !values[k] || BILL_ADDRESS_KEYS.has(k))),
        };
      });
    }
  }, [baseData, fromInvoiceId]);

  const handlePendingInvoiceChange = useCallback((next: InvoiceRef | null) => {
    setPendingInvoiceState(next);
    setApplicationAmountError(null);
  }, []);

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
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { isWorkflowEnabled, isLoading: workflowsLoading } = useWorkflows();
  const canCreateCreditMemo = !permissionsLoading
    && !workflowsLoading
    && hasPermission('credit_memo', 'create')
    && isWorkflowEnabled('credit_memo');

  // New payments default to USD once the lookups load — derived rather than
  // copied into state, so it never clobbers a value the user (or a picked
  // customer's defaults) already set.
  const formData = useMemo(() => {
    if (!lookups) return data;
    return { ...data, currency_id: data.currency_id || defaultCurrencyId(lookups.currencies) };
  }, [data, lookups]);
  const paymentCurrencyId = currencyIdFrom(formData);
  const paymentCurrencyCode = currencyCodeFrom(formData, lookups);
  // The invoice picked but not yet added counts too, so a payment opened from
  // an invoice is checked against it before any application row exists.
  const checkLines = useMemo(() => {
    const pending = pendingInvoiceLine(pendingInvoice, parseFloat(pendingAmount), Number(formData.amount), appliedLines);
    return pending ? [...appliedLines, pending] : appliedLines;
  }, [pendingInvoice, pendingAmount, formData.amount, appliedLines]);
  const paymentCheck = useMemo(
    () => checkPaymentAgainstInvoices(Number(formData.amount), checkLines),
    [formData.amount, checkLines],
  );

  // Shared with the return-trip hook — it may stash and restore this.
  const { startCreate: startCreateCustomer } = customerReturn.provide({
    activeTab,
    localData,
    localCustomer,
    customerTouched,
    customFieldValues,
    localApplications,
    localAppliedInvoiceNumbers,
    localAppliedInvoiceBalances,
    pendingInvoice: pendingInvoiceState,
  });

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const paymentWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'payment');
  const { data: paymentDef } = useQuery({
    queryKey: ['workflow', paymentWorkflow?.id],
    queryFn: () => workflowService.get(paymentWorkflow?.id ?? ''),
    enabled: Boolean(paymentWorkflow?.id),
  });
  const customFieldDefs = activeCustomFields(paymentDef);

  function addApplication() {
    if (!pendingInvoice) return;
    const amount = parseFloat(pendingAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setLocalApplications((current) => [
      ...(current ?? []),
      { invoiceUuid: pendingInvoice.id, amount },
    ]);
    setLocalAppliedInvoiceNumbers((current) => ({
      ...(current ?? {}),
      [pendingInvoice.id]: pendingInvoice.number,
    }));
    setLocalAppliedInvoiceBalances((current) => ({
      ...(current ?? {}),
      [pendingInvoice.id]: pendingInvoice.balanceDue,
    }));
    setPendingInvoiceState(null);
    setPendingAmount('');
    setApplicationAmountError(null);
    setAmountError(null);
  }

  function removeApplication(invoiceUuid: string) {
    setLocalApplications((current) => (current ?? []).filter((row) => row.invoiceUuid !== invoiceUuid));
    setLocalAppliedInvoiceNumbers((current) => {
      const next = { ...(current ?? {}) };
      delete next[invoiceUuid];
      return next;
    });
    setLocalAppliedInvoiceBalances((current) => {
      const next = { ...(current ?? {}) };
      delete next[invoiceUuid];
      return next;
    });
    setApplicationAmountError(null);
    setAmountError(null);
  }

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: async (confirmedOverage: ExcessPaymentPrompt | null) => {
      if (!customer) throw new Error('A customer is required.');
      // Confirming raises the payment to the larger of the two amounts entered.
      const paymentAmount = confirmedOverage ? confirmedOverage.enteredAmount : Number(formData.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Enter a valid payment amount.');
      }
      const effectiveApplications = confirmedOverage
        ? applicationsForConfirmedExcess(applications, confirmedOverage.applications)
        : applications;
      if (effectiveApplications.some((application) => !Number.isFinite(application.amount) || application.amount <= 0)) {
        throw new Error('Enter a valid amount for every applied invoice.');
      }
      const appliedTotal = effectiveApplications.reduce((total, application) => total + application.amount, 0);
      if (appliedTotal > paymentAmount + PAYMENT_AMOUNT_TOLERANCE) {
        throw new Error('Applied invoice amounts cannot exceed the payment amount.');
      }
      if (fromInvoiceId) {
        const latestSourceInvoice = await invoiceService.getInvoice(fromInvoiceId);
        if (!INVOICE_PAYABLE_STATUSES.has(latestSourceInvoice.statusCode)) {
          throw new Error('The source invoice is no longer eligible for payment. Remove it or return to the invoice.');
        }
        const knownBalance = appliedInvoiceBalances[fromInvoiceId]
          ?? confirmedOverage?.applications.find((line) => line.invoiceUuid === fromInvoiceId)?.balanceDue;
        if (
          knownBalance !== undefined
          && Math.abs(latestSourceInvoice.balanceDue - knownBalance) > PAYMENT_AMOUNT_TOLERANCE
        ) {
          throw new Error('The source invoice balance changed. Remove and re-add it before saving.');
        }
      }
      const payload = {
        ...toCreatePayload(formData, customer.id, customFieldValues),
        amount: paymentAmount,
        applications: effectiveApplications,
      };
      return paymentService.createPayment(payload);
    },
    onError: () => {
      if (fromInvoiceId) queryClient.invalidateQueries({ queryKey: ['invoice', fromInvoiceId] });
    },
    onSuccess: async (payment, confirmedOverage) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (fromInvoiceId) {
        queryClient.invalidateQueries({ queryKey: ['invoice', fromInvoiceId] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(payment.id); } catch { /* non-fatal */ }
      }
      const creditMemoAmount = confirmedOverage
        ? creditMemoExcessAmount(confirmedOverage.excessAmount, payment.unappliedAmount)
        : 0;
      if (
        confirmedOverage
        && customer
        && canCreateCreditMemo
        && creditMemoAmount > PAYMENT_AMOUNT_TOLERANCE
      ) {
        toast.success('Payment created. Review the prefilled credit memo.');
        navigate('/sales/credit_memo/new', {
          state: {
            [CREDIT_MEMO_FROM_PAYMENT_STATE]: {
              customer: { id: customer.id, name: customer.name },
              invoices: confirmedOverage.applications.map((application) => ({
                id: application.invoiceUuid,
                number: application.invoiceNumber,
              })),
              payment: { id: payment.id, number: payment.paymentNumber || undefined },
              currencyId: payment.currencyId ?? confirmedOverage.currencyId,
              currencyCode: confirmedOverage.currencyCode,
              unappliedAmount: creditMemoAmount,
            },
          },
        });
        return;
      }
      toast.success(confirmedOverage
        ? 'Payment created. No unapplied balance is available for a credit memo.'
        : 'Payment created.');
      navigate(returnPath);
    },
  });

  function submitPayment() {
    if (sourceInvoiceUnavailable || applicationAmountError) return;
    if (paymentCheck.excessAmount > 0 && customer) {
      setOverpaymentPrompt({
        customerName: customer.name,
        applications: checkLines,
        paymentAmount: Number(formData.amount),
        enteredAmount: paymentCheck.enteredAmount,
        balanceTotal: paymentCheck.balanceTotal,
        excessAmount: paymentCheck.excessAmount,
        currencyId: paymentCurrencyId,
        currencyCode: paymentCurrencyCode,
        canCreateCreditMemo,
      });
      return;
    }
    // Only reachable with several invoices: one is over its own balance while
    // another still has room, so the total is not really in excess. Which
    // invoice should take the difference is the user's call, and the backend
    // rejects an over-applied row, so send that row back to be corrected.
    if (paymentCheck.overBalanceLines.length > 0) {
      sendRowBackForCorrection(paymentCheck.overBalanceLines[0], paymentCurrencyCode);
      return;
    }
    save(null);
  }

  function sendRowBackForCorrection(line: AppliedInvoiceLine, currencyCode: string) {
    removeApplication(line.invoiceUuid);
    setPendingInvoiceState({ id: line.invoiceUuid, number: line.invoiceNumber, balanceDue: line.balanceDue });
    setPendingAmount(line.balanceDue.toFixed(2));
    setApplicationAmountError(
      `Application amount for ${line.invoiceNumber} cannot exceed ${currency(line.balanceDue, currencyCode)}. Re-add it with that amount or less, or clear the invoice to save without an application.`,
    );
  }

  function confirmExcess() {
    if (!overpaymentPrompt) return;
    const confirmed = overpaymentPrompt;
    setOverpaymentPrompt(null);
    save(confirmed);
  }

  function rejectExcess() {
    const rejected = overpaymentPrompt;
    setOverpaymentPrompt(null);
    if (!rejected) return;
    // A row that is itself over its invoice's balance needs fixing too — put
    // it back in the picker now rather than surfacing it on the next Save.
    const overBalance = checkPaymentAgainstInvoices(rejected.paymentAmount, rejected.applications).overBalanceLines[0];
    if (overBalance) sendRowBackForCorrection(overBalance, rejected.currencyCode);
    // Only when the Payment Amount field is itself over the balance. Set after
    // the row is sent back — removing a row clears the amount error.
    if (rejected.paymentAmount > rejected.balanceTotal + PAYMENT_AMOUNT_TOLERANCE) {
      const balance = currency(rejected.balanceTotal, rejected.currencyCode);
      setAmountError(`Payment amount cannot exceed the invoice balance of ${balance}. Enter ${balance} or less to save.`);
    }
  }

  const errorRef = useScrollToError<HTMLDivElement>(saveError);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); submitPayment(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel={fromInvoiceId ? 'Invoice' : 'Payments'}
          onBack={() => navigate(returnPath)}
          icon={CreditCard}
          title="New Payment"
          subtitle={sourceInvoice ? `For invoice ${sourceInvoice.invoiceNumber}` : 'Fields marked * are required.'}
          actions={(
            <button type="submit" disabled={isPending || sourceInvoiceUnavailable}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Payment'}
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
              {apiErrorMessage(saveError, 'Failed to save payment.')}
            </p>
          </div>
        )}

        {fromInvoiceId && sourceInvoiceLoading ? (
          <div role="status" className="flex flex-1 items-center justify-center gap-2 bg-stone-50 text-sm text-stone-600">
            <Loader2 className="size-4 animate-spin" />
            Loading source invoice…
          </div>
        ) : fromInvoiceId && sourceInvoiceError ? (
          <div role="alert" className="flex flex-1 items-center justify-center bg-stone-50 px-6 text-center text-sm text-red-700">
            {apiErrorMessage(sourceInvoiceError, 'Failed to load the source invoice.')}
          </div>
        ) : fromInvoiceId && !sourceInvoicePayable ? (
          <div role="alert" className="flex flex-1 items-center justify-center bg-stone-50 px-6 text-center text-sm text-red-700">
            The source invoice is no longer eligible for payment. Return to the invoice and start a new payment.
          </div>
        ) : (
          <>
        {/* ── Page-level tab bar ── */}
        <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

            {activeTab === 'details' && (
              <>
                <ModernSection title="Customer" index={0}>
                  <CustomerPicker value={customer} onChange={handleCustomerChange} required onCreateNew={startCreateCustomer} />
                </ModernSection>

                <ModernSection title="Payment Details" index={1}>
                  <PaymentSectionGrid
                    fields={PRIMARY_INFO_FIELDS}
                    data={formData}
                    set={set}
                    lookups={lookups}
                    errors={amountError ? { amount: amountError } : undefined}
                  />
                </ModernSection>

                {customFieldDefs.length > 0 && (
                  <ModernSection title="Custom Fields" index={2}>
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      {customFieldDefs.map((def) => (
                        <DynamicFieldInput
                          key={def.id}
                          field={def}
                          value={customFieldValues[def.key]}
                          onChange={setCustomField}
                        />
                      ))}
                    </div>
                  </ModernSection>
                )}

                <ModernSection title="Apply to Invoices (optional)" index={3}>
                  <div className="space-y-3">
                    {applications.length > 0 && (
                      <div className="space-y-1.5">
                        {applications.map((app) => (
                          <div key={app.invoiceUuid} className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                            <span className="font-medium text-stone-700">{appliedInvoiceNumbers[app.invoiceUuid]}</span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-stone-600">{currency(app.amount, paymentCurrencyCode)}</span>
                              <button
                                type="button"
                                onClick={() => removeApplication(app.invoiceUuid)}
                                aria-label={`Remove application to ${appliedInvoiceNumbers[app.invoiceUuid]}`}
                                className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <InvoicePicker
                          customer={customer}
                          value={pendingInvoice}
                          onChange={handlePendingInvoiceChange}
                          excludeIds={applications.map((a) => a.invoiceUuid)}
                        />
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pendingAmount}
                        onChange={(e) => setPendingAmount(e.target.value)}
                        placeholder="Amount"
                        aria-label="Application amount"
                        className={`${fieldCls} sm:w-32`}
                      />
                      <button
                        type="button"
                        onClick={addApplication}
                        disabled={!pendingInvoice || !(parseFloat(pendingAmount) > 0)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <Plus className="size-3.5" />
                        Add
                      </button>
                    </div>
                    {applicationAmountError && (
                      <p role="alert" className="text-xs font-medium text-destructive">
                        {applicationAmountError}
                      </p>
                    )}
                    {!customer && (
                      <p className="text-2xs text-stone-400">Select a customer above to apply this payment to their invoices.</p>
                    )}
                  </div>
                </ModernSection>
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the payment.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>
          </>
        )}

        <FormActionBar
          onCancel={() => navigate(returnPath)}
          isPending={isPending}
          isSubmitDisabled={sourceInvoiceUnavailable}
          submitLabel="Save Payment"
        />
      </form>
      {overpaymentPrompt && (
        <ExcessPaymentDialog
          prompt={overpaymentPrompt}
          onConfirm={confirmExcess}
          onReject={rejectExcess}
        />
      )}
    </div>
  );
}
