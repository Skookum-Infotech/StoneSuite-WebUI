import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { PurchaseOrderFormBody } from './components/PurchaseOrderFormBody';
import type { VendorRef } from './components/VendorPicker';
import {
  fromPurchaseOrder, toCreatePayload, calcHeaderTotals, PAGE_TABS, type PageTab,
  type PurchaseOrderLineItem, PO_NON_DRAFT_LOCKED,
} from '@/lib/purchaseOrderForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: PurchaseOrderLineItem[] = [];
const EMPTY_CUSTOM: Record<string, unknown> = {};

// Editing a purchase order is DRFT-only (backend enforces with 400) — a PO is
// an outward commitment once submitted, so any other status renders read-only
// with "Recall to draft to edit" (mirrors EditEstimatePage's terminal-status
// lock, but PO's lock covers every non-DRFT status, not just terminal ones).
export default function EditPurchaseOrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<PurchaseOrderLineItem[] | null>(null);
  const [localVendor, setLocalVendor] = useState<VendorRef | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: po, isLoading, error: loadError } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrderService.getPurchaseOrder(id),
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
    if (po?.purchaseOrderNumber) {
      setLabel(id, po.purchaseOrderNumber);
      return () => clearLabel(id);
    }
  }, [id, po?.purchaseOrderNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (po ? fromPurchaseOrder(po) : null), [po]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const vendor = localVendor ?? mapped?.vendor ?? null;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = po ? PO_NON_DRAFT_LOCKED(po.statusCode) : false;

  // Baseline against the loaded record, not the empty defaults, so simply opening
  // the page never counts as an edit. A locked PO is read-only — nothing to lose.
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
  const shippingCharge = parseFloat(String(data.shipping_charge ?? '')) || 0;
  const adjustment = parseFloat(String(data.adjustment ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent, shippingCharge, adjustment),
    [lineItems, headerTaxPercent, shippingCharge, adjustment],
  );

  const save = useMutation({
    mutationFn: () => purchaseOrderService.updatePurchaseOrder(id, toCreatePayload(data, lineItems, customFieldValues)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      guard.markClean();
      navigate(`/purchases/purchase_order/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading purchase order…" /></div>;
  if (loadError || !po)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load purchase order.')}</ErrorNote></div>;

  if (isLocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Purchase Orders"
          onBack={() => navigate(`/purchases/purchase_order/${id}`)}
          icon={Package}
          title={po.purchaseOrderNumber || 'Purchase Order'}
          subtitle={po.vendor.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This purchase order is {po.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">Recall it to Draft from the detail page to make changes.</p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/purchase_order/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to purchase order
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
          backLabel="Purchase Orders"
          onBack={() => navigate('/purchases/purchase_order')}
          icon={Package}
          title={po.purchaseOrderNumber || 'Purchase Order'}
          subtitle={vendor?.name ?? 'Edit purchase order'}
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
              {apiErrorMessage(save.error, 'Failed to save purchase order.')}
            </p>
          </div>
        )}

        <PurchaseOrderFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          purchaseOrderId={id}
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
          shippingCharge={shippingCharge}
          adjustment={adjustment}
          total={total}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/purchase_order/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
