import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileCheck, AlertCircle, Loader2, Save } from 'lucide-react';
import { vendorBillService } from '@/services/vendorBillService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { VendorBillFormBody } from './components/VendorBillFormBody';
import {
  vendorBillDefaults, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type VendorBillLineItem,
} from '@/lib/vendorBillForm';

export default function AddVendorBillPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(vendorBillDefaults);
  const [lineItems, setLineItems] = useState<VendorBillLineItem[]>([]);
  const [vendor, setVendor] = useState<VendorRef | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

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

  const guard = useUnsavedChangesGuard({ data, lineItems, vendor, customFieldValues });

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, adjustment),
    [lineItems, headerTaxPercent, adjustment],
  );

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('A vendor is required.');
      const payload = toCreatePayload({ ...data, vendor_uuid: vendor.id }, lineItems, customFieldValues);
      return vendorBillService.createVendorBill(payload);
    },
    onSuccess: async (bill) => {
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

        <VendorBillFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
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

        <FormActionBar
          onCancel={() => navigate('/purchases/vendor_bill')}
          isPending={isPending}
          submitLabel="Save Vendor Bill"
        />
      </form>
    </div>
  );
}
