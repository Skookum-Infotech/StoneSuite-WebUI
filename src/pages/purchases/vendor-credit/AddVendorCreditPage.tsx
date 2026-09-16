import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { vendorCreditService } from '@/services/vendorCreditService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { VendorCreditFormBody } from './components/VendorCreditFormBody';
import {
  PRIMARY_INFO_FIELDS, vendorCreditDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/vendorCreditForm';

/** Unsaved form state carried across a "Create Vendor" round trip. */
interface VendorCreditDraft {
  activeTab: PageTab;
  data: Record<string, unknown>;
  vendor: VendorRef | null;
  customFieldValues: Record<string, unknown>;
}

export default function AddVendorCreditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const vendorReturn = useRecordCreateReturn<VendorCreditDraft, VendorRef>(
    'vendor', '/purchases/vendor/new', { resource: 'vendor', action: 'create' },
  );
  const restored = vendorReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(() => restored?.data ?? vendorCreditDefaults());
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

  const guard = useUnsavedChangesGuard({ data, vendor, customFieldValues }, true, vendorReturn.isRestored);

  // Shared with the return-trip hook — it may stash and restore this.
  const { startCreate: startCreateVendor } = vendorReturn.provide({ activeTab, data, vendor, customFieldValues }, guard.markClean);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('A vendor is required.');
      return vendorCreditService.createVendorCredit(toCreatePayload(data, vendor.id, customFieldValues));
    },
    onSuccess: async (credit) => {
      toast.success('Vendor credit created.');
      queryClient.invalidateQueries({ queryKey: ['vendor-credits'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(credit.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/vendor_credit');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Vendor Credits"
          onBack={() => navigate('/purchases/vendor_credit')}
          icon={FilePlus}
          title="New Vendor Credit"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Vendor Credit'}
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
              {apiErrorMessage(saveError, 'Failed to save vendor credit.')}
            </p>
          </div>
        )}

        <VendorCreditFormBody
          shell={{ activeTab, setActiveTab }}
          form={{
            fields: PRIMARY_INFO_FIELDS, data, set, lookups,
            customFieldValues, setCustomField,
          }}
          vendor={{ value: vendor, onChange: setVendor, onCreateNew: startCreateVendor }}
          filesPanelRef={panelRef}
        >
          <ModernSection title="Note" index={2}>
            <p className="text-2xs text-stone-400">
              This credit starts as a Draft. Approve it from its detail page before applying it
              to a vendor bill.
            </p>
          </ModernSection>
        </VendorCreditFormBody>

        <FormActionBar
          onCancel={() => navigate('/purchases/vendor_credit')}
          isPending={isPending}
          submitLabel="Save Vendor Credit"
        />
      </form>
    </div>
  );
}
