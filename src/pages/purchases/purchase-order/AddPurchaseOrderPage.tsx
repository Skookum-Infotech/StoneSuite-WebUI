import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Package, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { lookupService } from '@/services/lookupService';
import { companyProfileService } from '@/services/companyProfileService';
import { companyLocationService } from '@/services/companyLocationService';
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
import { useScrollToError } from '@/hooks/useScrollToError';
import { PurchaseOrderFormBody } from './components/PurchaseOrderFormBody';
import { DocumentReviewShell } from '@/components/tenant/documentReview/DocumentReviewShell';
import { ReviewDialogs } from '@/components/tenant/documentReview/ReviewDialogs';
import { ReviewFooter } from '@/components/tenant/documentReview/ReviewFooter';
import { DocumentFailedNotice } from '@/components/tenant/documentReview/DocumentFailedNotice';
import { DocumentUsedNotice } from '@/components/tenant/documentReview/DocumentUsedNotice';
import { usePurchaseOrderReviewMode } from '@/hooks/usePurchaseOrderReviewMode';
import type { PurchaseOrderReviewPatch } from '@/hooks/purchaseReviewTypes';
import { PURCHASE_ORDER_REVIEW_FIELDS } from '@/lib/reviewFieldConfigs';
import {
  purchaseOrderDefaults, toCreatePayload, calcHeaderTotals, PAGE_TABS, SHIP_TO_FIELDS, type PageTab,
  type PurchaseOrderLineItem,
} from '@/lib/purchaseOrderForm';
import { firstInvalidPhoneLabel } from '@/lib/phoneValidation';

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

  // "Create from document" review mode (?fromDocument=<id>) — inert otherwise.
  const applyReviewForm = useCallback((next: PurchaseOrderReviewPatch) => {
    if (next.data) setData(next.data);
    if (next.lineItems) setLineItems(next.lineItems);
    if (next.vendor !== undefined) setVendor(next.vendor);
    if (next.customFieldValues) setCustomFieldValues(next.customFieldValues);
  }, []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Ship To prefill: the tenant's default Location when one is set, else
  // their Company Info address — see purchaseOrderShipToDefaults. Both are
  // gated on the company_profile read permission so a user without it
  // doesn't take a silent 403 on every load of this page (Locations reuses
  // that same permission — see companylocation's controller doc comment).
  const { hasPermission } = useUserPermissions();
  const canReadCompanyInfo = hasPermission('company_profile', 'read');
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
    staleTime: 10 * 60 * 1000,
    enabled: canReadCompanyInfo,
  });
  const { data: companyLocations } = useQuery({
    queryKey: ['company-locations'],
    queryFn: companyLocationService.list,
    staleTime: 10 * 60 * 1000,
    enabled: canReadCompanyInfo,
  });
  const defaultLocation = companyLocations?.find((l) => l.isDefault);

  // New purchase orders default to United States / USD, and Ship To from the
  // company defaults above, once each loads — derived rather than copied
  // into state, so it never clobbers a value the user already set.
  const geo = useMemo(() => (lookups ? { countries: lookups.countries, states: lookups.states } : undefined), [lookups]);
  const review = usePurchaseOrderReviewMode({
    form: { data, lineItems, vendor, customFieldValues },
    apply: applyReviewForm,
    onVendorChange: setVendor,
    geo,
  });
  // A ship-to read from the document is used whole: the company's own street,
  // city or zip must never fill the parts the document left out.
  const documentShipTo = review.active && Boolean(data.ship_address1 || data.ship_city || data.ship_zip);

  const formData = useMemo(() => {
    if (!lookups) return data;
    const shipDefaults = documentShipTo ? {} as ReturnType<typeof purchaseOrderShipToDefaults> : purchaseOrderShipToDefaults(companyProfile, defaultLocation);
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
      ship_phone: data.ship_phone || shipDefaults.ship_phone || '',
    };
  }, [data, lookups, companyProfile, defaultLocation, documentShipTo]);

  // A document-prefilled form is unsaved work from the start — except for a
  // document that was already used or couldn't be read, which shows no form.
  const documentUsed = review.active && review.phase === 'used';
  const documentFailed = review.active && review.phase === 'failed';
  const guard = useUnsavedChangesGuard(
    { data, lineItems, vendor, customFieldValues },
    !review.active || review.hydrated,
    inventoryReturn.isRestored || vendorReturn.isRestored || (review.active && !documentUsed && !documentFailed),
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
      const badPhone = firstInvalidPhoneLabel(SHIP_TO_FIELDS, formData);
      if (badPhone) throw new Error(`Enter a valid phone number for ${badPhone}.`);
      const payload = {
        ...toCreatePayload({ ...formData, vendor_uuid: vendor.id }, lineItems, customFieldValues),
        ...review.payloadExtras(false),
      };
      return purchaseOrderService.createPurchaseOrder(payload);
    },
    onError: (err) => { review.handleSaveError(err, () => save()); },
    onSuccess: async (po) => {
      if (!review.active) toast.success('Purchase order created.');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(po.id); } catch { /* non-fatal */ }
      }
      if (review.active) await review.afterCreate(po);
      guard.markClean();
      navigate('/purchases/purchase_order');
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);
  const withReviewShell = (body: ReactNode) => (
    review.active ? <DocumentReviewShell review={review} fields={PURCHASE_ORDER_REVIEW_FIELDS}>{body}</DocumentReviewShell> : body
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); if (review.blockedReason) review.focusFirstPending(); else save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Purchase Orders"
          onBack={() => navigate('/purchases/purchase_order')}
          icon={Package}
          title={review.active ? 'New Purchase Order from Document' : 'New Purchase Order'}
          subtitle="Fields marked * are required."
          actions={review.active ? undefined : (
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Purchase Order'}
            </button>
          )}
        />

        {saveError && !review.duplicate && (
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
              {apiErrorMessage(saveError, 'Failed to save purchase order.')}
            </p>
          </div>
        )}

        {documentUsed ? (
          <DocumentUsedNotice fileName={review.fileName} usedRecordUuid={review.banner.usedRecordUuid} docType="purchase_order" />
        ) : documentFailed ? (
          <DocumentFailedNotice fileName={review.fileName} reason={review.banner.failureMessage} docType="purchase_order" />
        ) : (<>
        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft, guard.markClean)}>
          {withReviewShell(
          <PurchaseOrderFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={formData}
            set={set}
            lineItems={lineItems}
            setLineItems={setLineItems}
            vendor={vendor}
            setVendor={review.active ? review.pickParty : setVendor}
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
          />,
          )}
        </InventoryItemReturnContext.Provider>

        {review.active ? (
          <>
            <ReviewFooter reason={review.blockedReason} isPending={isPending} onDiscard={review.requestDiscard} saveLabel="Save Purchase Order" />
            <ReviewDialogs review={review} onCreateAnyway={() => save()} markClean={guard.markClean} />
          </>
        ) : (
          <FormActionBar
            onCancel={() => navigate('/purchases/purchase_order')}
            isPending={isPending}
            submitLabel="Save Purchase Order"
          />
        )}
        </>)}
      </form>
    </div>
  );
}
