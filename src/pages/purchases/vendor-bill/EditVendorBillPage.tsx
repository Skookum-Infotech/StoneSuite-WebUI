import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { vendorBillService } from '@/services/vendorBillService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { VendorBillFormBody } from './components/VendorBillFormBody';
import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import {
  fromVendorBill, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type VendorBillLineItem, VB_NON_DRAFT_LOCKED,
} from '@/lib/vendorBillForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: VendorBillLineItem[] = [];
const EMPTY_CUSTOM: Record<string, unknown> = {};

// Editing a vendor bill is DRFT-only (backend enforces with 400) — mirrors
// EditPurchaseOrderPage's terminal-status lock, but VB's lock covers every
// non-DRFT status, not just terminal ones.
export default function EditVendorBillPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<VendorBillLineItem[] | null>(null);
  const [localVendor, setLocalVendor] = useState<VendorRef | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: bill, isLoading, error: loadError } = useQuery({
    queryKey: ['vendor-bill', id],
    queryFn: () => vendorBillService.getVendorBill(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (bill?.vendorBillNumber) {
      setLabel(id, bill.vendorBillNumber);
      return () => clearLabel(id);
    }
  }, [id, bill?.vendorBillNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (bill ? fromVendorBill(bill) : null), [bill]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const vendor = localVendor ?? mapped?.vendor ?? null;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = bill ? VB_NON_DRAFT_LOCKED(bill.statusCode) : false;

  // Baseline against the loaded record, not the empty defaults, so simply opening
  // the page never counts as an edit. A locked bill is read-only — nothing to lose.
  const guard = useUnsavedChangesGuard(
    { data, lineItems, vendor, customFieldValues },
    Boolean(mapped) && !isLocked,
  );

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) => setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, adjustment),
    [lineItems, headerTaxPercent, adjustment],
  );

  const save = useMutation({
    mutationFn: () => vendorBillService.updateVendorBill(id, toCreatePayload(data, lineItems, customFieldValues)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      guard.markClean();
      navigate(`/purchases/vendor_bill/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor bill…" /></div>;
  if (loadError || !bill)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load vendor bill.')}</ErrorNote></div>;

  if (isLocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Vendor Bills"
          onBack={() => navigate(`/purchases/vendor_bill/${id}`)}
          icon={FileCheck}
          title={bill.vendorBillNumber || 'Vendor Bill'}
          subtitle={bill.vendor.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This vendor bill is {bill.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">Recall it to Draft from the detail page to make changes.</p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/vendor_bill/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to vendor bill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Vendor Bills"
          onBack={() => navigate('/purchases/vendor_bill')}
          icon={FileCheck}
          title={bill.vendorBillNumber || 'Vendor Bill'}
          subtitle={vendor?.name ?? 'Edit vendor bill'}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {save.error && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save vendor bill.')}
            </p>
          </div>
        )}

        <VendorBillFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          vendorBillId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          vendor={vendor}
          setVendor={setLocalVendor}
          vendorLocked
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          adjustment={adjustment}
          total={total}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/vendor_bill/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
