import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileMinus, AlertCircle, Loader2, Save } from 'lucide-react';
import { creditMemoService } from '@/services/creditMemoService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { type InvoiceRef } from './components/InvoicePicker';
import { type SalesOrderRef } from './components/SalesOrderPicker';
import { CreditMemoFormBody } from './components/CreditMemoFormBody';
import {
  creditMemoDefaults, toCreatePayload, PAGE_TABS, type PageTab,
  type CreditMemoLineItem,
} from '@/lib/creditMemoForm';

export default function AddCreditMemoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(creditMemoDefaults);
  const [lineItems, setLineItems] = useState<CreditMemoLineItem[]>([]);
  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRef | null>(null);
  const [salesOrder, setSalesOrder] = useState<SalesOrderRef | null>(null);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

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

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A customer is required.');
      if (lineItems.length === 0) throw new Error('At least one line item is required.');
      const payload = toCreatePayload(
        { ...data, customer_uuid: customer.id, invoice_uuid: invoice?.id, sales_order_uuid: salesOrder?.id },
        lineItems,
      );
      return creditMemoService.createCreditMemo(payload);
    },
    onSuccess: async (creditMemo) => {
      queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(creditMemo.id); } catch { /* non-fatal */ }
      }
      navigate(`/sales/credit_memo/${creditMemo.id}`);
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Credit Memos"
          onBack={() => navigate('/sales/credit_memo')}
          icon={FileMinus}
          title="New Credit Memo"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Credit Memo'}
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
              {apiErrorMessage(saveError, 'Failed to save credit memo.')}
            </p>
          </div>
        )}

        <CreditMemoFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLineItems}
          customer={customer}
          setCustomer={setCustomer}
          invoice={invoice}
          setInvoice={setInvoice}
          salesOrder={salesOrder}
          setSalesOrder={setSalesOrder}
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
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
