import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Receipt, AlertCircle, Loader2, Save } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields } from '@/lib/customerDefaults';
import { InvoiceFormBody } from './components/InvoiceFormBody';
import {
  invoiceDefaults, toCreatePayload, PAGE_TABS, type PageTab,
  type InvoiceLineItem,
} from '@/lib/invoiceForm';

export default function AddInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(invoiceDefaults);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

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

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = subtotal * (headerTaxPercent / 100);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems, headerTaxPercent]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A billing customer is required.');
      const payload = toCreatePayload({ ...data, customer_uuid: customer.id }, lineItems, customFieldValues);
      return invoiceService.createInvoice(payload);
    },
    onSuccess: async (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(invoice.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/invoice');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Invoices"
          onBack={() => navigate('/sales/invoice')}
          icon={Receipt}
          title="New Invoice"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Invoice'}
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
              {apiErrorMessage(saveError, 'Failed to save invoice.')}
            </p>
          </div>
        )}

        <InvoiceFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLineItems}
          customer={customer}
          setCustomer={handleCustomerChange}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          amountPaid={0}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/invoice')}
          isPending={isPending}
          submitLabel="Save Invoice"
        />
      </form>
    </div>
  );
}
