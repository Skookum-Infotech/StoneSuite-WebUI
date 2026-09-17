import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ClipboardList, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { requisitionService } from '@/services/requisitionService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from '../purchase-order/components/VendorPicker';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { useScrollToError } from '@/hooks/useScrollToError';
import { RequisitionFormBody } from './components/RequisitionFormBody';
import {
  requisitionDefaults, toCreatePayload, calcHeaderTotals, invalidLinePositions,
  PAGE_TABS, type PageTab, type RequisitionLineItem,
} from '@/lib/requisitionForm';

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface RequisitionDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  lineItems: RequisitionLineItem[];
  vendor: VendorRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddRequisitionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const inventoryReturn = useInventoryItemReturn<RequisitionDraft>();
  const vendorReturn = useRecordCreateReturn<RequisitionDraft, VendorRef>(
    'vendor', '/purchases/vendor/new', { resource: 'vendor', action: 'create' },
  );
  const restored = inventoryReturn.restored ?? vendorReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? requisitionDefaults());
  const [lineItems, setLineItems] = useState<RequisitionLineItem[]>(restored?.lineItems ?? []);
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

  const guard = useUnsavedChangesGuard(
    { data, lineItems, vendor, customFieldValues },
    true,
    inventoryReturn.isRestored || vendorReturn.isRestored,
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { subtotal, taxTotal, estimatedTotal } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent),
    [lineItems, headerTaxPercent],
  );

  // Shared by both return-trip hooks — either one may stash and restore it.
  const draft: RequisitionDraft = { activeTab, data, lineItems, vendor, customFieldValues };
  const { startCreate: startCreateVendor } = vendorReturn.provide(draft, guard.markClean);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      // The server requires every line to carry either a catalog item or a
      // description; catch it here so the user sees which row is at fault
      // rather than a whole-form 400.
      const bad = invalidLinePositions(lineItems);
      if (bad.length > 0) {
        throw new Error(
          `Every line needs an item or a description — check line ${bad.join(', ')}.`,
        );
      }
      const payload = toCreatePayload(
        { ...data, vendor_uuid: vendor?.id ?? '' },
        lineItems,
        customFieldValues,
      );
      return requisitionService.createRequisition(payload);
    },
    onSuccess: async (reqn) => {
      toast.success('Requisition created.');
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(reqn.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/requisition');
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Requisitions"
          onBack={() => navigate('/purchases/requisition')}
          icon={ClipboardList}
          title="New Requisition"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Requisition'}
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
              {apiErrorMessage(saveError, 'Failed to save requisition.')}
            </p>
          </div>
        )}

        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft, guard.markClean)}>
          <RequisitionFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={data}
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
            taxTotal={taxTotal}
            estimatedTotal={estimatedTotal}
            filesPanelRef={panelRef}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate('/purchases/requisition')}
          isPending={isPending}
          submitLabel="Save Requisition"
        />
      </form>
    </div>
  );
}
