import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { requisitionService } from '@/services/requisitionService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { RequisitionFormBody } from './components/RequisitionFormBody';
import type { VendorRef } from '../purchase-order/components/VendorPicker';
import {
  fromRequisition, toCreatePayload, calcHeaderTotals, invalidLinePositions,
  PAGE_TABS, type PageTab, type RequisitionLineItem, REQN_NON_DRAFT_LOCKED,
} from '@/lib/requisitionForm';

// Stable references so the fallbacks don't create a new identity every render
// (which would defeat the totals useMemo below).
const EMPTY_ITEMS: RequisitionLineItem[] = [];
const EMPTY_CUSTOM: Record<string, unknown> = {};

// Editing a requisition is DRFT-only (backend enforces with 400) — once
// submitted it is awaiting someone's sign-off, so any other status renders
// read-only with "recall to draft to edit". Mirrors EditPurchaseOrderPage.
export default function EditRequisitionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<RequisitionLineItem[] | null>(null);
  const [localVendor, setLocalVendor] = useState<VendorRef | null>(null);
  const [vendorTouched, setVendorTouched] = useState(false);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: reqn, isLoading, error: loadError } = useQuery({
    queryKey: ['requisition', id],
    queryFn: () => requisitionService.getRequisition(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Never show a raw record UUID in the breadcrumb — swap in the requisition
  // number once the record loads, and clear it on unmount.
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (reqn?.requisitionNumber) {
      setLabel(id, reqn.requisitionNumber);
      return () => clearLabel(id);
    }
  }, [id, reqn?.requisitionNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (reqn ? fromRequisition(reqn) : null), [reqn]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  // Unlike a purchase order, a requisition's suggested vendor stays editable —
  // and is clearable. `vendorTouched` distinguishes "not yet edited" (fall back
  // to the loaded value) from "deliberately cleared" (keep null), which a plain
  // `localVendor ?? mapped.vendor` cannot express.
  const vendor = vendorTouched ? localVendor : (mapped?.vendor ?? null);
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = reqn ? REQN_NON_DRAFT_LOCKED(reqn.statusCode) : false;

  const setVendor = useCallback((v: VendorRef | null) => {
    setVendorTouched(true);
    setLocalVendor(v);
  }, []);

  // Baseline against the loaded record, not the empty defaults, so simply
  // opening the page never counts as an edit. A locked requisition is
  // read-only — nothing to lose.
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

  const { subtotal, taxTotal, estimatedTotal } = useMemo(
    () => calcHeaderTotals(lineItems, headerTaxPercent),
    [lineItems, headerTaxPercent],
  );

  const save = useMutation({
    mutationFn: () => {
      const bad = invalidLinePositions(lineItems);
      if (bad.length > 0) {
        throw new Error(`Every line needs an item or a description — check line ${bad.join(', ')}.`);
      }
      return requisitionService.updateRequisition(
        id,
        toCreatePayload({ ...data, vendor_uuid: vendor?.id ?? '' }, lineItems, customFieldValues),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition', id] });
      queryClient.invalidateQueries({ queryKey: ['requisitions'] });
      guard.markClean();
      navigate(`/purchases/requisition/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading requisition…" /></div>;
  // A 404 here can mean "exists but is out of your scope" as well as "no such
  // record", so the copy stays non-committal about whether it exists.
  if (loadError || !reqn)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Requisition not available.')}</ErrorNote></div>;

  if (isLocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Requisitions"
          onBack={() => navigate(`/purchases/requisition/${id}`)}
          icon={ClipboardList}
          title={reqn.requisitionNumber || 'Requisition'}
          subtitle={reqn.department || undefined}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This requisition is {reqn.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">Recall it to Draft from the detail page to make changes.</p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/requisition/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to requisition
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
          backLabel="Requisitions"
          onBack={() => navigate('/purchases/requisition')}
          icon={ClipboardList}
          title={reqn.requisitionNumber || 'Requisition'}
          subtitle={reqn.department || 'Edit requisition'}
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
              {apiErrorMessage(save.error, 'Failed to save requisition.')}
            </p>
          </div>
        )}

        <RequisitionFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          requisitionId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          vendor={vendor}
          setVendor={setVendor}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          subtotal={subtotal}
          taxTotal={taxTotal}
          estimatedTotal={estimatedTotal}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/requisition/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
