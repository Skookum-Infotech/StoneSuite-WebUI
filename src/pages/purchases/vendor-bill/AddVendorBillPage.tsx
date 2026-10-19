import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react';
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
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { useScrollToError } from '@/hooks/useScrollToError';
import { VendorBillFormBody } from './components/VendorBillFormBody';
import { DocumentReviewShell } from '@/components/tenant/documentReview/DocumentReviewShell';
import { ReviewDialogs } from '@/components/tenant/documentReview/ReviewDialogs';
import { ReviewFooter } from '@/components/tenant/documentReview/ReviewFooter';
import { DocumentFailedNotice } from '@/components/tenant/documentReview/DocumentFailedNotice';
import { DocumentUsedNotice } from '@/components/tenant/documentReview/DocumentUsedNotice';
import { useVendorBillReviewMode } from '@/hooks/useVendorBillReviewMode';
import type { VendorBillReviewPatch } from '@/hooks/purchaseReviewTypes';
import { VENDOR_BILL_REVIEW_FIELDS } from '@/lib/reviewFieldConfigs';
import type { VendorBillPurchaseOrderRef } from '@/types/vendorBill';
import { duplicateFrom, type DuplicateConflict } from '@/lib/salesOrderDuplicate';
import { DuplicateCreateDialog } from '@/components/tenant/documentReview/DuplicateCreateDialog';
import {
  vendorBillDefaults, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type VendorBillLineItem,
} from '@/lib/vendorBillForm';

const MANUAL_DUPLICATE_MESSAGE = 'A bill with this vendor invoice number already exists for this vendor.';

/** Clears every line's link to a purchase-order line. */
function unlinkPoLines(lines: VendorBillLineItem[]): VendorBillLineItem[] {
  return lines.some((l) => l.purchaseOrderItemId) ? lines.map((l) => ({ ...l, purchaseOrderItemId: undefined })) : lines;
}

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface VendorBillDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  lineItems: VendorBillLineItem[];
  vendor: VendorRef | null;
  purchaseOrder: VendorBillPurchaseOrderRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddVendorBillPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const inventoryReturn = useInventoryItemReturn<VendorBillDraft>();
  const vendorReturn = useRecordCreateReturn<VendorBillDraft, VendorRef>(
    'vendor', '/purchases/vendor/new', { resource: 'vendor', action: 'create' },
  );
  const restored = inventoryReturn.restored ?? vendorReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? vendorBillDefaults());
  const [lineItems, setLineItems] = useState<VendorBillLineItem[]>(restored?.lineItems ?? []);
  const [vendor, setVendor] = useState<VendorRef | null>(restored?.vendor ?? null);
  const [purchaseOrder, setPurchaseOrder] = useState<VendorBillPurchaseOrderRef | null>(restored?.purchaseOrder ?? null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});
  const [manualDuplicate, setManualDuplicate] = useState<DuplicateConflict | null>(null);

  // A linked purchase order must belong to the bill's vendor, so switching (or
  // clearing) the vendor drops the link rather than leaving a stale one the
  // server would reject.
  // A line billed against the old order's line goes with the link, or the
  // server would refuse a line link without (or to another) order.
  const vendorIdRef = useRef(vendor?.id);
  useEffect(() => { vendorIdRef.current = vendor?.id; }, [vendor]);
  const changeVendor = useCallback((next: VendorRef | null) => {
    if (next?.id !== vendorIdRef.current) {
      setPurchaseOrder(null);
      setLineItems((ls) => unlinkPoLines(ls));
    }
    vendorIdRef.current = next?.id;
    setVendor(next);
  }, []);
  const changePurchaseOrder = useCallback((next: VendorBillPurchaseOrderRef | null) => {
    setPurchaseOrder(next);
    setLineItems((ls) => unlinkPoLines(ls));
  }, []);

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
      changeVendor(vendorReturn.createdRef);
      vendorReturn.consumeCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorReturn.createdRef]);

  // "Create from document" review mode (?fromDocument=<id>) — inert otherwise.
  const applyReviewForm = useCallback((next: VendorBillReviewPatch) => {
    if (next.data) setData(next.data);
    if (next.lineItems) setLineItems(next.lineItems);
    if (next.vendor !== undefined) { vendorIdRef.current = next.vendor?.id; setVendor(next.vendor); }
    if (next.purchaseOrder !== undefined) setPurchaseOrder(next.purchaseOrder);
    if (next.customFieldValues) setCustomFieldValues(next.customFieldValues);
  }, []);
  const review = useVendorBillReviewMode({
    form: { data, lineItems, vendor, purchaseOrder, customFieldValues },
    apply: applyReviewForm,
    onVendorChange: changeVendor,
  });

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

  // A document-prefilled form is unsaved work from the start — except for a
  // document that was already used or couldn't be read, which shows no form.
  const documentUsed = review.active && review.phase === 'used';
  const documentFailed = review.active && review.phase === 'failed';
  const guard = useUnsavedChangesGuard(
    { data, lineItems, vendor, purchaseOrder, customFieldValues },
    !review.active || review.hydrated,
    inventoryReturn.isRestored || vendorReturn.isRestored || (review.active && !documentUsed && !documentFailed),
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, adjustment),
    [lineItems, headerTaxPercent, adjustment],
  );

  // Shared by both return-trip hooks — either one may stash and restore it.
  const draft: VendorBillDraft = { activeTab, data, lineItems, vendor, purchaseOrder, customFieldValues };
  const { startCreate: startCreateVendor } = vendorReturn.provide(draft, guard.markClean);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: (opts?: { allowDuplicate?: boolean }) => {
      if (!vendor) throw new Error('A vendor is required.');
      const payload = {
        ...toCreatePayload(
          { ...formData, vendor_uuid: vendor.id, purchase_order_uuid: purchaseOrder?.id },
          lineItems,
          customFieldValues,
        ),
        // A manual create answers the same 409; its "Create anyway" resends with this flag.
        ...(opts?.allowDuplicate && !review.active ? { allowDuplicate: true } : {}),
        ...review.payloadExtras(Boolean(opts?.allowDuplicate)),
      };
      return vendorBillService.createVendorBill(payload);
    },
    onError: (err) => {
      if (!review.handleSaveError(err, () => save({ allowDuplicate: true }))) {
        const dup = duplicateFrom(err, MANUAL_DUPLICATE_MESSAGE);
        if (dup) setManualDuplicate(dup);
      }
    },
    onSuccess: async (bill) => {
      if (!review.active) toast.success('Vendor bill created.');
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(bill.id); } catch { /* non-fatal */ }
      }
      if (review.active) await review.afterCreate(bill);
      guard.markClean();
      navigate('/purchases/vendor_bill');
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);
  const duplicate = review.duplicate ?? manualDuplicate;
  const withReviewShell = (body: ReactNode) => (
    review.active ? <DocumentReviewShell review={review} fields={VENDOR_BILL_REVIEW_FIELDS}>{body}</DocumentReviewShell> : body
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); if (review.blockedReason) review.focusFirstPending(); else save({}); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Vendor Bills"
          onBack={() => navigate('/purchases/vendor_bill')}
          icon={FileCheck}
          title={review.active ? 'New Vendor Bill from Document' : 'New Vendor Bill'}
          subtitle="Fields marked * are required."
          actions={review.active ? undefined : (
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Vendor Bill'}
            </button>
          )}
        />

        {saveError && !duplicate && (
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
              {apiErrorMessage(saveError, 'Failed to save vendor bill.')}
            </p>
          </div>
        )}

        {documentUsed ? (
          <DocumentUsedNotice fileName={review.fileName} usedRecordUuid={review.banner.usedRecordUuid} docType="vendor_bill" />
        ) : documentFailed ? (
          <DocumentFailedNotice fileName={review.fileName} reason={review.banner.failureMessage} docType="vendor_bill" />
        ) : (<>
        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft, guard.markClean)}>
          {withReviewShell(
          <VendorBillFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={formData}
            set={set}
            lineItems={lineItems}
            setLineItems={setLineItems}
            vendor={vendor}
            setVendor={review.active ? review.pickParty : changeVendor}
            onCreateVendor={startCreateVendor}
            purchaseOrder={purchaseOrder}
            setPurchaseOrder={changePurchaseOrder}
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            adjustment={adjustment}
            total={total}
            filesPanelRef={panelRef}
          />,
          )}
        </InventoryItemReturnContext.Provider>

        {review.active ? (
          <>
            <ReviewFooter reason={review.blockedReason} isPending={isPending} onDiscard={review.requestDiscard} saveLabel="Save Vendor Bill" />
            <ReviewDialogs review={review} onCreateAnyway={() => save({ allowDuplicate: true })} markClean={guard.markClean} />
          </>
        ) : (
          <FormActionBar
            onCancel={() => navigate('/purchases/vendor_bill')}
            isPending={isPending}
            submitLabel="Save Vendor Bill"
          />
        )}
        {!review.active && manualDuplicate && (
          <DuplicateCreateDialog
            conflict={manualDuplicate}
            docType="vendor_bill"
            onOpenExisting={(uuid) => { setManualDuplicate(null); guard.markClean(); navigate(`/purchases/vendor_bill/${uuid}`); }}
            onCreateAnyway={() => { setManualDuplicate(null); save({ allowDuplicate: true }); }}
            onCancel={() => setManualDuplicate(null)}
          />
        )}
        </>)}
      </form>
    </div>
  );
}
