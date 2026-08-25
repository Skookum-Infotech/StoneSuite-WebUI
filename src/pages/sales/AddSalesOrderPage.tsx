import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ShoppingCart, AlertCircle, Loader2, Save } from 'lucide-react';
import { salesOrderService } from '@/services/salesOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields } from '@/lib/customerDefaults';
import { SalesOrderFormBody } from './components/SalesOrderFormBody';
import {
  soDefaults, toCreatePayload, PAGE_TABS, type PageTab,
  type SOLineItem, type SODrawing,
} from '@/lib/salesOrderForm';

export default function AddSalesOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(soDefaults);
  const [lineItems, setLineItems] = useState<SOLineItem[]>([]);
  const [drawings, setDrawings] = useState<SODrawing[]>([]);
  const [customer, setCustomer] = useState<CustomerRef | null>(null);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

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

  const guard = useUnsavedChangesGuard({ data, lineItems, drawings, customer });

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = lineItems.reduce((s, r) => s + (parseFloat(r.total) || 0) - (parseFloat(r.amount) || 0), 0);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A billing customer is required.');
      const payload = toCreatePayload({ ...data, customer_uuid: customer.id }, lineItems);
      return salesOrderService.createOrder(payload);
    },
    onSuccess: async (order) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(order.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/sales/sales_order');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Sales Orders"
          onBack={() => navigate('/sales/sales_order')}
          icon={ShoppingCart}
          title="New Sales Order"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Order'}
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
              {apiErrorMessage(saveError, 'Failed to save sales order.')}
            </p>
          </div>
        )}

        <SalesOrderFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLineItems}
          drawings={drawings}
          setDrawings={setDrawings}
          customer={customer}
          setCustomer={handleCustomerChange}
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/sales_order')}
          isPending={isPending}
          submitLabel="Save Order"
        />
      </form>
    </div>
  );
}
