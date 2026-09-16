import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileCheck, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { vendorBillService } from '@/services/vendorBillService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { defaultCurrencyId } from '@/lib/lookupDefaults';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { VendorBillFormBody } from './components/VendorBillFormBody';
import {
  vendorBillDefaults, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type VendorBillLineItem,
} from '@/lib/vendorBillForm';

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface VendorBillDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  lineItems: VendorBillLineItem[];
  vendor: VendorRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddVendorBillPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const inventoryReturn = useInventoryItemReturn<VendorBillDraft>();
  const restored = inventoryReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? vendorBillDefaults());
  const [lineItems, setLineItems] = useState<VendorBillLineItem[]>(restored?.lineItems ?? []);
  const [vendor, setVendor] = useState<VendorRef | null>(restored?.vendor ?? null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // New vendor bills default to USD once the lookups load — derived rather
  // than copied into state, so it never clobbers a value the user already
  // set.
  const formData = useMemo(() => {
    if (!lookups) return data;
    return { ...data, currency_id: data.currency_id || defaultCurrencyId(lookups.currencies) };
  }, [data, lookups]);

  const guard = useUnsavedChangesGuard({ data, lineItems, vendor, customFieldValues }, true, inventoryReturn.isRestored);

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, adjustment),
    [lineItems, headerTaxPercent, adjustment],
  );

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('A vendor is required.');
      const payload = toCreatePayload({ ...formData, vendor_uuid: vendor.id }, lineItems, customFieldValues);
      return vendorBillService.createVendorBill(payload);
    },
    onSuccess: async (bill) => {
      toast.success('Vendor bill created.');
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(bill.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/vendor_bill');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Vendor Bills"
          onBack={() => navigate('/purchases/vendor_bill')}
          icon={FileCheck}
          title="New Vendor Bill"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Vendor Bill'}
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
              {apiErrorMessage(saveError, 'Failed to save vendor bill.')}
            </p>
          </div>
        )}

        <InventoryItemReturnContext.Provider
          value={inventoryReturn.provide({ activeTab, data, lineItems, vendor, customFieldValues }, guard.markClean)}
        >
          <VendorBillFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={formData}
            set={set}
            lineItems={lineItems}
            setLineItems={setLineItems}
            vendor={vendor}
            setVendor={setVendor}
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            adjustment={adjustment}
            total={total}
            filesPanelRef={panelRef}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate('/purchases/vendor_bill')}
          isPending={isPending}
          submitLabel="Save Vendor Bill"
        />
      </form>
    </div>
  );
}
