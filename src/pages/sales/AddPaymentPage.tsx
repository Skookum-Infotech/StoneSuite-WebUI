import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save, Plus, X } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { lookupService } from '@/services/lookupService';
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
import { customerDefaultFields } from '@/lib/customerDefaults';
import { InvoicePicker } from './components/InvoicePicker';
import type { InvoiceRef } from './components/InvoicePicker';
import { PaymentSectionGrid } from './components/PaymentFormFields';
import {
  PRIMARY_INFO_FIELDS, paymentDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/paymentForm';
import type { ApplicationInput } from '@/types/payment';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function AddPaymentPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(paymentDefaults);
  const [customer, setCustomer]   = useState<CustomerRef | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const [applications, setApplications] = useState<ApplicationInput[]>([]);
  const [appliedInvoiceNumbers, setAppliedInvoiceNumbers] = useState<Record<string, string>>({});
  const [pendingInvoice, setPendingInvoice] = useState<InvoiceRef | null>(null);
  const [pendingAmount, setPendingAmount] = useState('');

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const handleCustomerChange = useCallback((next: CustomerRef | null) => {
    setCustomer(next);
    if (next) {
      const defaults = customerDefaultFields(next);
      setData((d) => ({
        ...d,
        ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !d[k])),
      }));
    }
  }, []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
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
    setApplications((a) => [...a, { invoiceUuid: pendingInvoice.id, amount }]);
    setAppliedInvoiceNumbers((m) => ({ ...m, [pendingInvoice.id]: pendingInvoice.number }));
    setPendingInvoice(null);
    setPendingAmount('');
  }

  function removeApplication(invoiceUuid: string) {
    setApplications((a) => a.filter((row) => row.invoiceUuid !== invoiceUuid));
    setAppliedInvoiceNumbers((m) => {
      const next = { ...m };
      delete next[invoiceUuid];
      return next;
    });
  }

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A customer is required.');
      const payload = { ...toCreatePayload(data, customer.id, customFieldValues), applications };
      return paymentService.createPayment(payload);
    },
    onSuccess: async (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(payment.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/payment');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Payments"
          onBack={() => navigate('/sales/payment')}
          icon={CreditCard}
          title="New Payment"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Payment'}
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
              {apiErrorMessage(saveError, 'Failed to save payment.')}
            </p>
          </div>
        )}

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
                  <CustomerPicker value={customer} onChange={handleCustomerChange} required />
                </ModernSection>

                <ModernSection title="Payment Details" index={1}>
                  <PaymentSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} lookups={lookups} />
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
                              <span className="tabular-nums text-stone-600">{currency(app.amount)}</span>
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
                          onChange={setPendingInvoice}
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

        <FormActionBar
          onCancel={() => navigate('/sales/payment')}
          isPending={isPending}
          submitLabel="Save Payment"
        />
      </form>
    </div>
  );
}
