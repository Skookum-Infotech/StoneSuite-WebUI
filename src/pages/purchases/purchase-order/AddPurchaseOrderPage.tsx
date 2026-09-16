import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Package, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { lookupService } from '@/services/lookupService';
import { companyProfileService } from '@/services/companyProfileService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from './components/VendorPicker';
import { defaultCountryId, defaultCurrencyId } from '@/lib/lookupDefaults';
import { purchaseOrderShipToDefaults } from '@/lib/purchaseOrderShipToDefaults';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { PurchaseOrderFormBody } from './components/PurchaseOrderFormBody';
import {
  purchaseOrderDefaults, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type PurchaseOrderLineItem,
} from '@/lib/purchaseOrderForm';

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface PurchaseOrderDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  lineItems: PurchaseOrderLineItem[];
  vendor: VendorRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddPurchaseOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const inventoryReturn = useInventoryItemReturn<PurchaseOrderDraft>();
  const vendorReturn = useRecordCreateReturn<PurchaseOrderDraft, VendorRef>(
    'vendor', '/purchases/vendor/new', { resource: 'vendor', action: 'create' },
  );
  const restored = inventoryReturn.restored ?? vendorReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? purchaseOrderDefaults());
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>(restored?.lineItems ?? []);
  const [vendor, setVendor] = useState<VendorRef | null>(restored?.vendor ?? null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  // Applies the vendor created via the round trip exactly as if it had been
  // picked from the list.
  useEffect(() => {
    if (vendorReturn.createdRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVendor(vendorReturn.createdRef);
      vendorReturn.consumeCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorReturn.createdRef]);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Ship To prefill: always the tenant's own Company Info address — see
  // purchaseOrderShipToDefaults. Company Info is gated on the read
  // permission so a user without it doesn't take a silent 403 on every
  // load of this page.
  const { hasPermission } = useUserPermissions();
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
    staleTime: 10 * 60 * 1000,
    enabled: hasPermission('company_profile', 'read'),
  });

  // New purchase orders default to United States / USD, and Ship To from the
  // company defaults above, once each loads — derived rather than copied
  // into state, so it never clobbers a value the user already set.
  const formData = useMemo(() => {
    if (!lookups) return data;
    const shipDefaults = purchaseOrderShipToDefaults(companyProfile);
    return {
      ...data,
      ship_country: data.ship_country || defaultCountryId(lookups.countries),
      currency_id: data.currency_id || defaultCurrencyId(lookups.currencies),
      ship_name: data.ship_name || shipDefaults.ship_name || '',
      ship_address1: data.ship_address1 || shipDefaults.ship_address1 || '',
      ship_address2: data.ship_address2 || shipDefaults.ship_address2 || '',
      ship_suite: data.ship_suite || shipDefaults.ship_suite || '',
      ship_city: data.ship_city || shipDefaults.ship_city || '',
      ship_state: data.ship_state || shipDefaults.ship_state || '',
      ship_zip: data.ship_zip || shipDefaults.ship_zip || '',
    };
  }, [data, lookups, companyProfile]);

  const guard = useUnsavedChangesGuard(
    { data, lineItems, vendor, customFieldValues },
    true,
    inventoryReturn.isRestored || vendorReturn.isRestored,
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const shippingCharge = parseFloat(String(data.shipping_charge ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, shippingCharge, adjustment),
    [lineItems, headerTaxPercent, shippingCharge, adjustment],
  );

  // Shared by both return-trip hooks — either one may stash and restore it.
  const draft: PurchaseOrderDraft = { activeTab, data, lineItems, vendor, customFieldValues };
  const { startCreate: startCreateVendor } = vendorReturn.provide(draft, guard.markClean);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('A vendor is required.');
      const payload = toCreatePayload({ ...formData, vendor_uuid: vendor.id }, lineItems, customFieldValues);
      return purchaseOrderService.createPurchaseOrder(payload);
    },
    onSuccess: async (po) => {
      toast.success('Purchase order created.');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(po.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/purchase_order');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Purchase Orders"
          onBack={() => navigate('/purchases/purchase_order')}
          icon={Package}
          title="New Purchase Order"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Purchase Order'}
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
              {apiErrorMessage(saveError, 'Failed to save purchase order.')}
            </p>
          </div>
        )}

        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft, guard.markClean)}>
          <PurchaseOrderFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={formData}
            set={set}
            lineItems={lineItems}
            setLineItems={setLineItems}
            vendor={vendor}
            setVendor={setVendor}
            onCreateVendor={startCreateVendor}
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            shippingCharge={shippingCharge}
            adjustment={adjustment}
            total={total}
            filesPanelRef={panelRef}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate('/purchases/purchase_order')}
          isPending={isPending}
          submitLabel="Save Purchase Order"
        />
      </form>
    </div>
  );
}
