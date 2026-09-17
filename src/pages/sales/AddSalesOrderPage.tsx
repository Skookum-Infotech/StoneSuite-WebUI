import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ShoppingCart, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { salesOrderService } from '@/services/salesOrderService';
import { lookupService } from '@/services/lookupService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields, BILL_ADDRESS_KEYS } from '@/lib/customerDefaults';
import { shipSameAsBillFields } from '@/lib/shipToDefaults';
import { defaultCountryId, defaultCurrencyId } from '@/lib/lookupDefaults';
import { statusToastLabel } from '@/lib/statusToast';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { useScrollToError } from '@/hooks/useScrollToError';
import { SalesOrderFormBody } from './components/SalesOrderFormBody';
import {
  soDefaults, toCreatePayload, PAGE_TABS, SO_STATUS_CODES, type PageTab,
  type SOLineItem, type SODrawing,
} from '@/lib/salesOrderForm';

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface SalesOrderDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  lineItems: SOLineItem[];
  drawings: SODrawing[];
  customer: CustomerRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddSalesOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const inventoryReturn = useInventoryItemReturn<SalesOrderDraft>();
  const customerReturn = useRecordCreateReturn<SalesOrderDraft, CustomerRef>(
    'customer', '/crm/customer/new', { resource: 'customer', action: 'create' },
  );
  const restored = inventoryReturn.restored ?? customerReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? soDefaults());
  const [lineItems, setLineItems] = useState<SOLineItem[]>(restored?.lineItems ?? []);
  const [drawings, setDrawings] = useState<SODrawing[]>(restored?.drawings ?? []);
  const [customer, setCustomer] = useState<CustomerRef | null>(restored?.customer ?? null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});

  const set = useCallback((key: string, value: unknown) => {
    setData((d) => {
      if (key === 'ship_same_as_bill' && value === true) {
        return { ...d, ...shipSameAsBillFields(d, customer?.name), [key]: value };
      }
      return { ...d, [key]: value };
    });
  }, [customer]);
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
        ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !d[k] || BILL_ADDRESS_KEYS.has(k))),
      }));
    }
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

  // New orders default to United States / USD once the lookups load — derived
  // rather than copied into state, so it never clobbers a value the user (or
  // a picked customer's defaults) already set, and the guard below still
  // tracks only actual edits to `data`.
  const formData = useMemo(() => {
    if (!lookups) return data;
    return {
      ...data,
      bill_country: data.bill_country || defaultCountryId(lookups.countries),
      ship_country: data.ship_country || defaultCountryId(lookups.countries),
      currency_id: data.currency_id || defaultCurrencyId(lookups.currencies),
    };
  }, [data, lookups]);

  const guard = useUnsavedChangesGuard(
    { data, lineItems, drawings, customer, customFieldValues },
    true,
    inventoryReturn.isRestored || customerReturn.isRestored,
  );

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = lineItems.reduce((s, r) => s + (parseFloat(r.total) || 0) - (parseFloat(r.amount) || 0), 0);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems]);

  // Shared by both return-trip hooks — either one may stash and restore it.
  const draft: SalesOrderDraft = { activeTab, data, lineItems, drawings, customer, customFieldValues };
  const { startCreate: startCreateCustomer } = customerReturn.provide(draft, guard.markClean);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A billing customer is required.');
      const payload = toCreatePayload({ ...formData, customer_uuid: customer.id }, lineItems, customFieldValues);
      return salesOrderService.createOrder(payload);
    },
    onSuccess: async (order) => {
      const panel = panelRef.current;
      const hadStagedFiles = panel?.hasStagedFiles() ?? false;
      if (panel && hadStagedFiles) {
        try { await panel.uploadStagedTo(order.id); } catch { /* non-fatal */ }
      }

      // Submitting a new order should read as "Pending Approval", not sit in
      // Draft — but only once it actually has an attachment (same rule the
      // status pill enforces on a manual DRFT->PAPV move, see
      // SalesOrderStatusControl.tsx). uploadStagedTo() never rejects even on
      // a failed upload, so re-check via the attachments list rather than
      // trusting that promise resolving.
      let autoSubmitted = false;
      if (hadStagedFiles) {
        try {
          const attachments = await attachmentService.listAttachments(order.id);
          if (attachments.length > 0) {
            await salesOrderService.transition(order.id, 'PAPV');
            toast.success(`Moved to ${statusToastLabel(SO_STATUS_CODES, 'PAPV')}.`);
            autoSubmitted = true;
          }
        } catch { /* non-fatal — order was created; it just stays in Draft */ }
      }
      if (!autoSubmitted) toast.success('Sales order created.');

      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      guard.markClean();
      navigate('/sales/sales_order');
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);

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
              {apiErrorMessage(saveError, 'Failed to save sales order.')}
            </p>
          </div>
        )}

        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft, guard.markClean)}>
          <SalesOrderFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={formData}
            set={set}
            lineItems={lineItems}
            setLineItems={setLineItems}
            drawings={drawings}
            setDrawings={setDrawings}
            customer={customer}
            setCustomer={handleCustomerChange}
            onCreateCustomer={startCreateCustomer}
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            total={total}
            filesPanelRef={panelRef}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate('/sales/sales_order')}
          isPending={isPending}
          submitLabel="Save Order"
        />
      </form>
    </div>
  );
}
